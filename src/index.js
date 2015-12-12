import 'babel-polyfill';

import request from 'request';
import * as commandMatcher from './commandMatcher';
import {Queue} from './queue';

const DEFAULT_URL = "https://api.telegram.org/bot{token}";
const DEFAULT_LONGPOLL_TIMEOUT = 60;
const DEFAULT_COMMAND_TIMEOUT = 10;

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

class Bot {
    constructor(token, opts = {}) {
        if (! token) {
            throw new Error("The token parameter is required. See https://core.telegram.org/bots/api#authorizing-your-bot for more details.");
        }

        this.token = token;
        this.options = Object.assign({}, {
            url: DEFAULT_URL,
            longPollTimeout: DEFAULT_LONGPOLL_TIMEOUT,
            commandTimeout: DEFAULT_COMMAND_TIMEOUT
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

        apiRequest(this.url + '/getMe').then((res) => {
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
     * Long-polls for updates from the server
     * @param  {Function} cb Callback to call for each new update
     * @return {Function}    Stops polling
     */
    pollForUpdates(cb) {
        let polling = true;
        let updatesUrl = this.url + '/getUpdates';

        let pollAgain = (delay = 0) => {
            if (! polling) return;

            setTimeout(() => {
                this.pollForUpdates(cb);
            }, delay);
        };

        apiRequest(updatesUrl, {
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

    onUpdate(cb) {
        this.listeners.update.push(cb);
    }

    on(event, cb) {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(cb);
    }

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
        }

        // If all the listeners finish without stopping, stop the queue here
        queue.add(queue.stop.bind(queue));

        if (this.options.commandTimeout > 0) {
            setTimeout(queue.stop.bind(queue), this.options.commandTimeout * 1000);
        }
    }

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

    callListener(listener, update, next, done) {
        listener.call(null, this, update, next, done);
    }

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

    sendMessage(chatId, str, params = {}) {
        params.chat_id = chatId;
        params.text = str;

        return apiRequest(this.url + '/sendMessage', params);
    }

    forwardMessage(chatId, fromChatId, messageId) {
        return apiRequest(this.url + '/forwardMessage', {
            chat_id: chatId,
            from_chat_id: fromChatId,
            message_id: messageId
        });
    }

    /**
     * Sends a photo
     * For uploading a photo, see allowed parameters here:
     * https://github.com/request/request#multipartform-data-multipart-form-uploads
     * @param  {Number} chatId ID of the target chat
     * @param  {mixed}  photo  File ID to resend or a file to upload
     * @return {Promise}       A promise that resolves once the API request has finished
     */
    sendPhoto(chatId, photo, params = {}) {
        var formData = {
            chat_id: chatId
        };

        if (typeof photo === 'string') {
            // Resend already uploaded file by file ID
            formData.file_id = photo;
        } else {
            formData.photo = photo;
        }

        Object.assign(formData, params);

        return apiPostRequest(this.url + '/sendPhoto', formData);
    }

    sendAudio(chatId, audio, params = {}) {
        var formData = {
            chat_id: chatId
        };

        if (typeof audio === 'string') {
            // Resend already uploaded file by file ID
            formData.file_id = audio;
        } else {
            formData.audio = audio;
        }

        Object.assign(formData, params);

        return apiPostRequest(this.url + '/sendAudio', formData);
    }

    sendDocument(chatId, document, params = {}) {
        var formData = {
            chat_id: chatId
        };

        if (typeof document === 'string') {
            // Resend already uploaded file by file ID
            formData.file_id = document;
        } else {
            formData.document = document;
        }

        Object.assign(formData, params);

        return apiPostRequest(this.url + '/sendDocument', formData);
    }

    sendSticker(chatId, sticker, params = {}) {
        var formData = {
            chat_id: chatId
        };

        if (typeof sticker === 'string') {
            // Resend already uploaded file by file ID
            formData.file_id = sticker;
        } else {
            formData.document = sticker;
        }

        Object.assign(formData, params);

        return apiPostRequest(this.url + '/sendSticker', formData);
    }

    sendVideo(chatId, video, params = {}) {
        var formData = {
            chat_id: chatId
        };

        if (typeof video === 'string') {
            // Resend already uploaded file by file ID
            formData.file_id = video;
        } else {
            formData.document = video;
        }

        Object.assign(formData, params);

        return apiPostRequest(this.url + '/sendVideo', formData);
    }

    sendVoice(chatId, voice, params = {}) {
        var formData = {
            chat_id: chatId
        };

        if (typeof voice === 'string') {
            // Resend already uploaded file by file ID
            formData.file_id = voice;
        } else {
            formData.document = voice;
        }

        Object.assign(formData, params);

        return apiPostRequest(this.url + '/sendVoice', formData);
    }

    sendLocation(chatId, latitude, longitude, params = {}) {
        var formData = {
            chat_id: chatId,
            latitude,
            longitude
        };

        Object.assign(formData, params);

        return apiPostRequest(this.url + '/sendLocation', formData);
    }

    sendAction(chatId, action, params = {}) {
        var formData = {
            chat_id: chatId,
            action
        };

        Object.assign(formData, params);

        return apiPostRequest(this.url + '/sendAction', formData);
    }

    getUserProfilePhotos(userId, params = {}) {
        params.user_id = userId;
        return apiRequest(this.url + '/getUserProfilePhotos', params);
    }

    setWebhook(url, certificate, params = {}) {
        params.url = url;
        params.certificate = certificate;

        return apiPostRequest(this.url + '/setWebhook');
    }

    getFile(fileId) {
        return apiRequest(this.url + '/getFile', {file_id: fileId});
    }
}

export {Bot as Bot};

let paramTypes = {
    WORD: commandMatcher.MATCH_WORD,
    NUM: commandMatcher.MATCH_NUM,
    REST: commandMatcher.MATCH_REST,
    STRING: commandMatcher.MATCH_STRING
};

export {paramTypes as paramTypes};
