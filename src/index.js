import 'babel-polyfill';

import request from 'request';
import * as commandMatcher from './commandMatcher';
import {Queue} from './queue';

const DEFAULT_URL = "https://api.telegram.org/bot{token}";
const DEFAULT_FILE_URL = "https://api.telegram.org/file/bot{token}";
const DEFAULT_LONGPOLL_TIMEOUT = 60;
const DEFAULT_LISTENER_TIMEOUT = 10;

let apiRequest = (url, params = {}) => {
    return new Promise((resolve) => {
        request({url: url, qs: params}, (err, res, body) => {
            if (err) {
                resolve(err);
            } else {
                let parsed = JSON.parse(body);
                resolve(parsed);
            }
        });
    });
};

let apiPostRequest = (url, formData = {}) => {
    return new Promise((resolve) => {
        request({url: url, formData: formData}, (err, res, body) => {
            if (err) {
                resolve(err);
            } else {
                let parsed = JSON.parse(body);
                resolve(parsed);
            }
        });
    });
};

/**
 * A JavaScript interface for using the Telegram Bot API
 *
 * This module also exports a `paramTypes` variable. See [global.html#paramTypes](global.html#paramTypes)
 *
 * @param {String} token Your bot's token. More information: (https://core.telegram.org/bots/api#authorizing-your-bot)[https://core.telegram.org/bots/api#authorizing-your-bot]
 * @param {Object} opts  (Optional) Extra options to pass to this bot instance. Available options include:
 * * **url** The base URL for API requests, including {token} for where the token should go (default: "https://api.telegram.org/bot{token}")
 * * **fileUrl** The base URL for file downloads, including {token} (default: "https://api.telegram.org/file/bot{token}")
 * * **longPollTimeout** Request timeout in seconds when long-polling; set to 0 for short-polling (default: 60)
 * * **listenerTimeout** Timeout in seconds when the next listener will automatically be called if the previous one has not called `next()` or `done()` (default: 10)
 * @class Bot
 */
class Bot {
    constructor(token, opts = {}) {
        if (! token) {
            throw new Error("The token parameter is required. See https://core.telegram.org/bots/api#authorizing-your-bot for more details.");
        }

        this.token = token;
        this.options = Object.assign({}, {
            url: DEFAULT_URL,
            fileUrl: DEFAULT_FILE_URL,
            longPollTimeout: DEFAULT_LONGPOLL_TIMEOUT,
            listenerTimeout: DEFAULT_LISTENER_TIMEOUT
        }, opts);

        // Full URL with token replaced
        this.url = this.options.url.replace('{token}', this.token);

        // Listeners for new messages/updates
        this.listeners = {
            "update": [],
            "text": []
        };

        // Last update ID, used as an offset for polling updates
        this.lastUpdateId = 0;

        // The bot's ID, username and display name; result of /getMe
        this.info = {};

        this.apiRequest('getMe').then((res) => {
            if (! res.ok) {
                throw new Error("getMe failed: " + res.description);
            }

            this.info = res.result;
        }).then(() => {
            let updateHandlerQueue = new Queue();

            this.callListenersOfType('ready');

            this.pollForUpdates((update) => {
                // "next" and "done" will be supplied by the queue
                updateHandlerQueue.add(this.callAllListeners.bind(this, update));
            });
        });
    }

    /**
     * Sends a GET API request to the specified method
     *
     * @method Bot#apiRequest
     * @param  {String} method Method to call
     * @param  {Object} params Query parameters of the request
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    apiRequest(method, params = {}) {
        return apiRequest(this.url + '/' + method, params);
    }

    /**
     * Sends a POST API request to the specified method
     *
     * @method Bot#apiPostRequest
     * @param  {String} method   Method to call
     * @param  {Object} formData Form data to send along with the request
     * @return {Promise}         A promise that resolves with the result once the API request has finished
     */
    apiPostRequest(method, formData = {}) {
        return apiPostRequest(this.url + '/' + method, formData);
    }

    /**
     * Long-polls for updates from the server
     *
     * @param  {Function} cb Callback to call for each new update
     * @return {Function}    When called, stops the polling
     * @access private
     */
    pollForUpdates(cb) {
        let polling = true;

        let pollAgain = (delay = 0) => {
            if (! polling) return;

            setTimeout(() => {
                this.pollForUpdates(cb);
            }, delay);
        };

        this.apiRequest('getUpdates', {
            timeout: this.options.longPollTimeout,
            offset: this.lastUpdateId + 1
        })
        .then((res) => {
            if (res instanceof Error) {
                console.error(res.stack);
                pollAgain(5000);
                return;
            }

            if (! res.ok) {
                console.error(res.description);
                pollAgain(1000);
                return;
            }

            let updates = res.result;
            if (updates.length > 0) {
                this.lastUpdateId = updates[updates.length - 1].update_id;
                updates.forEach(cb);
            }

            pollAgain();
        })
        .catch((err) => {
            console.error(err.stack);
            pollAgain(1000);
        });

        return () => {
            polling = false;
        };
    }

    /**
     * Attaches an event listener for the specified event type
     *
     * Available event types:
     * * `'update'`
     * * `'text'`
     * * `'audio'`
     * * `'document'`
     * * `'photo'`
     * * `'sticker'`
     * * `'video'`
     * * `'voice'`
     * * `'contact'`
     * * `'location'`
     * * `'new_chat_participant'`
     * * `'left_chat_participant'`
     * * `'new_chat_title'`
     * * `'new_chat_photo'`
     * * `'delete_chat_photo'`
     * * `'group_chat_created'`
     * * `'supergroup_chat_created'`
     * * `'channel_chat_created'`
     *
     * @param  {String}   event Type of event
     * @param  {Function} cb    Callback to call when the event fires
     * @return {void}
     */
    on(event, cb) {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(cb);
    }

    /**
     * Calls all listeners applicable for the given update
     * @param  {Object}   update The Telegram update object
     * @param  {Function} next   Will be called after every listener has finished or the command timeout has passed
     * @return {void}
     * @access private
     */
    callAllListeners(update, next) {
        // We return this queue for the main update queue
        // This ensures updates are handled in order
        let queue = new Queue();

        queue.finally(function() {
            next();
        });

        this.callListenersOfType('update', queue, update);

        if (update.message) {
            if (update.message.text) this.callListenersOfType('text', queue, update.message);
            if (update.message.audio) this.callListenersOfType('audio', queue, update.message);
            if (update.message.document) this.callListenersOfType('document', queue, update.message);
            if (update.message.photo) this.callListenersOfType('photo', queue, update.message);
            if (update.message.sticker) this.callListenersOfType('sticker', queue, update.message);
            if (update.message.video) this.callListenersOfType('video', queue, update.message);
            if (update.message.voice) this.callListenersOfType('voice', queue, update.message);
            if (update.message.contact) this.callListenersOfType('contact', queue, update.message);
            if (update.message.location) this.callListenersOfType('location', queue, update.message);
            if (update.message.new_chat_participant) this.callListenersOfType('new_chat_participant', queue, update.message);
            if (update.message.left_chat_participant) this.callListenersOfType('left_chat_participant', queue, update.message);
            if (update.message.new_chat_title) this.callListenersOfType('new_chat_title', queue, update.message);
            if (update.message.new_chat_photo) this.callListenersOfType('new_chat_photo', queue, update.message);
            if (update.message.delete_chat_photo) this.callListenersOfType('delete_chat_photo', queue, update.message);
            if (update.message.group_chat_created) this.callListenersOfType('group_chat_created', queue, update.message);
            if (update.message.supergroup_chat_created) this.callListenersOfType('supergroup_chat_created', queue, update.message);
            if (update.message.channel_chat_created) this.callListenersOfType('channel_chat_created', queue, update.message);
            if (update.message.inline_query) this.callListenersOfType('inline_query', queue, update.message);
        }

        // If all the listeners finish without stopping, stop the queue here
        queue.add(queue.stop.bind(queue));

        if (this.options.listenerTimeout > 0) {
            setTimeout(queue.stop.bind(queue), this.options.listenerTimeout * 1000);
        }
    }

    /**
     * Calls all listeners of the given type with the given update
     * The calls are added the queue `queue`, if given
     *
     * @param  {String} type   Type of listeners to call
     * @param  {Queue}  queue  (Optional) Queue to add the listener calls to
     * @param  {Object} update The Telegram update object
     * @return {void}
     * @access private
     */
    callListenersOfType(type, queue, update) {
        let list = this.listeners[type];
        if (! list) return;

        list.forEach((listener) => {
            // queue.add will supply the next and done params
            let call = this.callListener.bind(this, listener, update);

            if (queue) queue.add(call);
            else call();
        });
    }

    /**
     * Calls the specified listener with the given update
     *
     * @param  {Function}   listener Listener function to call
     * @param  {Object}   update   The Telegram update object
     * @param  {Function} next     A function to call when the next listener should be called
     * @param  {Function} done     A function to call when this should be the last listener for the update
     * @return {void}
     */
    callListener(listener, update, next, done) {
        listener.call(null, this, update, next, done);
    }

    /**
     * Attach an event listener to when a text message with a matching command is received
     *
     * This function accepts a variable number of arguments:
     * (cmd, cb)
     * (cmd, params, cb)
     * (triggerSymbol, cmd, params, cb)
     *
     * @param {String}   triggerSymbol String to prefix the command with; defaults to '/'
     * @param {String}   cmd           Command to match, WITHOUT the leading triggerSymbol (e.g. '/'); can use regex
     * @param {Array}    params        Parameters the command accepts. Parameters can either be regex strings or the following array construct:
     *
     * `[name, regexString, options]`
     *
     * Where name and regexString are strings and options is an optional object.
     * Available options:
     *
     * * **optional** Whether the parameter is optional or not; defaults to *false*
     * * **stripQuotes** Whether to strip wrapping quotes from parameters; defaults to *true*
     *
     * Parameters are matched as both `triggerSymbol+cmd` and `triggerSymbol+cmd@botUsername`.
     * For example, both of these will match: `/getLocation London` or `/getLocation@myBot London`
     *
     * The matched command can always be accessed via params._cmd (especially useful with dynamic commands)
     * @param {Function} cb            Listener to call when the command matches
     * @return {void}
     */
    onCommand() {
        let args = Array.prototype.slice.call(arguments);
        let cb = args[args.length - 1];
        args = args.slice(0, -1);

        if (typeof cb !== 'function') {
            throw new Error("[Bot::onCommand] Callback required");
        }

        this.on('text', (bot, message, next, done) => {
            let matchedParams = commandMatcher.match.apply(null, [message.text].concat(args).concat(this.info.username));

            if (matchedParams) {
                cb(bot, message, matchedParams, next, done);
            } else {
                next();
            }
        });
    }

    /**
     * Returns information about the bot user
     *
     * **Note**: this is already available via the `info` class property
     *
     * **More info:** [https://core.telegram.org/bots/api#getme](https://core.telegram.org/bots/api#getme)
     *
     * @return {Promise} A promise that resolves with the result once the API request has finished
     */
    getMe() {
        return this.apiRequest('getMe');
    }

    /**
     * Sends a message to the specified chat
     *
     * **More info:** [https://core.telegram.org/bots/api#sendmessage](https://core.telegram.org/bots/api#sendmessage)
     *
     * @param  {Number} chatId ID of the target chat
     * @param  {String} str    Message text
     * @param  {Array}  params (Optional) Additional params to supply to the request
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    sendMessage(chatId, str, params = {}) {
        params.chat_id = chatId;
        params.text = str;

        return this.apiRequest('sendMessage', params);
    }

    /**
     * Forwards the specified message ID
     *
     * **More info:** [https://core.telegram.org/bots/api#forwardmessage](https://core.telegram.org/bots/api#forwardmessage)
     *
     * @param  {Number} chatId     ID of the target chat
     * @param  {Number} fromChatId ID of the original chat
     * @param  {Number} messageId  ID of the message to forward
     * @return {Promise}           A promise that resolves with the result once the API request has finished
     */
    forwardMessage(chatId, fromChatId, messageId) {
        return this.apiRequest('forwardMessage', {
            chat_id: chatId,
            from_chat_id: fromChatId,
            message_id: messageId
        });
    }

    /**
     * Sends a photo to the specified chat
     *
     * For uploading a photo, see allowed parameters here:
     * [https://github.com/request/request#multipartform-data-multipart-form-uploads](https://github.com/request/request#multipartform-data-multipart-form-uploads)
     *
     * **More info:** [https://core.telegram.org/bots/api#sendphoto](https://core.telegram.org/bots/api#sendphoto)
     *
     * @method Bot#sendPhoto
     * @param  {Number} chatId ID of the target chat
     * @param  {mixed}  photo  File ID to resend or a file to upload
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    sendPhoto(chatId, photo, params = {}) {
        var formData = {
            chat_id: chatId,
            photo: photo
        };

        Object.assign(formData, params);

        return this.apiPostRequest('sendPhoto', formData);
    }

    /**
     * Sends audio to the specified chat
     *
     * For uploading an audio file, see allowed parameters here:
     * [https://github.com/request/request#multipartform-data-multipart-form-uploads](https://github.com/request/request#multipartform-data-multipart-form-uploads)
     *
     * **More info:** [https://core.telegram.org/bots/api#sendaudio](https://core.telegram.org/bots/api#sendaudio)
     *
     * @method Bot#sendAudio
     * @param  {Number} chatId ID of the target chat
     * @param  {mixed}  audio  File ID to resend or a file to upload
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    sendAudio(chatId, audio, params = {}) {
        var formData = {
            chat_id: chatId,
            audio: audio
        };

        Object.assign(formData, params);

        return this.apiPostRequest('sendAudio', formData);
    }

    /**
     * Sends a document to the specified chat
     *
     * For uploading a document file, see allowed parameters here:
     * [https://github.com/request/request#multipartform-data-multipart-form-uploads](https://github.com/request/request#multipartform-data-multipart-form-uploads)
     *
     * **More info:** [https://core.telegram.org/bots/api#senddocument](https://core.telegram.org/bots/api#senddocument)
     *
     * @method Bot#sendDocument
     * @param  {Number} chatId   ID of the target chat
     * @param  {mixed}  document File ID to resend or a file to upload
     * @return {Promise}         A promise that resolves with the result once the API request has finished
     */
    sendDocument(chatId, document, params = {}) {
        var formData = {
            chat_id: chatId,
            document: document
        };

        Object.assign(formData, params);

        return this.apiPostRequest('sendDocument', formData);
    }

    /**
     * Sends a sticker to the specified chat
     *
     * For uploading a sticker (image file), see allowed parameters here:
     * [https://github.com/request/request#multipartform-data-multipart-form-uploads](https://github.com/request/request#multipartform-data-multipart-form-uploads)
     *
     * **More info:** [https://core.telegram.org/bots/api#sendsticker](https://core.telegram.org/bots/api#sendsticker)
     *
     * @method Bot#sendSticker
     * @param  {Number} chatId  ID of the target chat
     * @param  {mixed}  sticker File ID to resend or a file to upload
     * @return {Promise}        A promise that resolves with the result once the API request has finished
     */
    sendSticker(chatId, sticker, params = {}) {
        var formData = {
            chat_id: chatId,
            sticker: sticker
        };

        Object.assign(formData, params);

        return this.apiPostRequest('sendSticker', formData);
    }

    /**
     * Sends a video to the specified chat
     *
     * For uploading a video file, see allowed parameters here:
     * [https://github.com/request/request#multipartform-data-multipart-form-uploads](https://github.com/request/request#multipartform-data-multipart-form-uploads)
     *
     * **More info:** [https://core.telegram.org/bots/api#sendvideo](https://core.telegram.org/bots/api#sendvideo)
     *
     * @method Bot#sendVideo
     * @param  {Number} chatId ID of the target chat
     * @param  {mixed}  video  File ID to resend or a file to upload
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    sendVideo(chatId, video, params = {}) {
        var formData = {
            chat_id: chatId,
            video: video
        };

        Object.assign(formData, params);

        return this.apiPostRequest('sendVideo', formData);
    }

    /**
     * Sends a voice recording to the specified chat
     *
     * For uploading a voice recording (an audio file), see allowed parameters here:
     * [https://github.com/request/request#multipartform-data-multipart-form-uploads](https://github.com/request/request#multipartform-data-multipart-form-uploads)
     *
     * **More info:** [https://core.telegram.org/bots/api#sendvoice](https://core.telegram.org/bots/api#sendvoice)
     *
     * @method Bot#sendVoice
     * @param  {Number} chatId ID of the target chat
     * @param  {mixed}  voice  File ID to resend or a file to upload
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    sendVoice(chatId, voice, params = {}) {
        var formData = {
            chat_id: chatId,
            voice: voice
        };

        Object.assign(formData, params);

        return this.apiPostRequest('sendVoice', formData);
    }

    /**
     * Sends a location to the specified chat
     *
     * **More info:** [https://core.telegram.org/bots/api#sendlocation](https://core.telegram.org/bots/api#sendlocation)
     *
     * @method Bot#sendLocation
     * @param  {Number}        chatId ID of the target chat
     * @param  {String|Number} latitude Latitude of the location
     * @param  {String|Number} longitude Longitude of the location
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    sendLocation(chatId, latitude, longitude, params = {}) {
        var formData = {
            chat_id: chatId,
            latitude,
            longitude
        };

        Object.assign(formData, params);

        return this.apiPostRequest('sendLocation', formData);
    }

    /**
     * Sends a chat action to the specified chat
     *
     * **More info:** [https://core.telegram.org/bots/api#sendchataction](https://core.telegram.org/bots/api#sendchataction)
     *
     * @method Bot#sendAction
     * @param  {Number} chatId ID of the target chat
     * @param  {String} action Type of action to send
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    sendAction(chatId, action, params = {}) {
        var formData = {
            chat_id: chatId,
            action
        };

        Object.assign(formData, params);

        return this.apiPostRequest('sendAction', formData);
    }

    /**
     * Returns a list of profile photos for the specified user
     *
     * **More info:** [https://core.telegram.org/bots/api#getuserprofilephotos](https://core.telegram.org/bots/api#getuserprofilephotos)
     *
     * @method Bot#getUserProfilePhotos
     * @param  {Number} userId ID of the user
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    getUserProfilePhotos(userId, params = {}) {
        params.user_id = userId;
        return this.apiRequest('getUserProfilePhotos', params);
    }

    /**
     * Sets an HTTPS URL where Telegram will send updates
     *
     * **Note:** this WILL disable all updates/messages from the API
     *
     * For uploading the certificate, see allowed parameters here:
     * [https://github.com/request/request#multipartform-data-multipart-form-uploads](https://github.com/request/request#multipartform-data-multipart-form-uploads)
     *
     * **More info:** [https://core.telegram.org/bots/api#setwebhook](https://core.telegram.org/bots/api#setwebhook)
     *
     * @method Bot#setWebhook
     * @param  {String} url         HTTPS url to send updates to
     * @param  {mixed}  certificate Your publickey certificate
     * @return {Promise}            A promise that resolves with the result once the API request has finished
     */
    setWebhook(url, certificate, params = {}) {
        params.url = url;
        params.certificate = certificate;

        return this.apiPostRequest('setWebhook');
    }

    /**
     * Returns information about the specified file ID
     *
     * **More info:** [https://core.telegram.org/bots/api#getfile](https://core.telegram.org/bots/api#getfile)
     *
     * @method Bot#getFile
     * @param  {Number} fileId ID of the file
     * @return {Promise}       A promise that resolves with the result once the API request has finished
     */
    getFile(fileId) {
        return this.apiRequest('getFile', {file_id: fileId});
    }

    /**
     * Returns the URL to the specified file. This URL is valid for at least 1 hour.
     *
     * **More info:** [https://core.telegram.org/bots/api#getfile](https://core.telegram.org/bots/api#getfile)
     *
     * @param  {String} filePath The file path, as returned by getFile
     * @return {String}          The file's URL
     */
    getFileURL(filePath) {
        return this.options.fileUrl.replace('{token}', this.token) + '/' + filePath;
    }

    /**
     * Sends a reply to an inline query
     *
     * **More info:** [https://core.telegram.org/bots/api#inline-mode](https://core.telegram.org/bots/api#inline-mode)
     *
     * @param  {Number} inlineQueryId ID of the inline query to reply to
     * @param  {Array} results       Array of InlineQueryResult (see link above)
     * @param  {Object} params       Optional extra parameters
     * @return {Promise}             A promise that resolves with the result once the API request has finished
     */
    answerInlineQuery(inlineQueryId, results, params = {}) {
        var formData = {
            inline_query_id: inlineQueryId,
            results: (typeof results !== 'string' ? JSON.stringify(results) : results)
        };

        Object.assign(formData, params);

        return this.apiPostRequest('answerInlineQuery', formData);
    }
}

export {Bot as Bot};

/**
 * Shortcut regexes for matching specific types of parameters
 *
 * * WORD matches any string without whitespace
 * * STRING matches any string without whitespace OR a double-quote enclosed string
 * * NUM matches a number (including negative numbers and decimals)
 * * REST matches anything, greedy; useful for commands where the last parameter can be any text
 *
 * All regexes include separating whitespace at the start. If you wish to not include this (for instance,
 * when building a command with a dynamic name), you can write the regex manually as a string.
 * @type {Object}
 */
let paramTypes = {
    WORD: commandMatcher.MATCH_WORD,
    STRING: commandMatcher.MATCH_STRING,
    NUM: commandMatcher.MATCH_NUM,
    REST: commandMatcher.MATCH_REST
};

export {paramTypes as paramTypes};
