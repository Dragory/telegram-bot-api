'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; })();

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.paramTypes = exports.Bot = undefined;

require('babel-polyfill');

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _commandMatcher = require('./commandMatcher');

var commandMatcher = _interopRequireWildcard(_commandMatcher);

var _queue = require('./queue');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_URL = "https://api.telegram.org/bot{token}";
var DEFAULT_FILE_URL = "https://api.telegram.org/file/bot{token}";
var DEFAULT_LONGPOLL_TIMEOUT = 60;
var DEFAULT_LISTENER_TIMEOUT = 10;
var DEFAULT_IGNORE_PRESTART_UPDATES = false;

var _apiRequest = function _apiRequest(url) {
    var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    return new Promise(function (resolve) {
        (0, _request2.default)({ url: url, qs: params }, function (err, res, body) {
            if (err) {
                resolve(err);
            } else {
                var parsed = JSON.parse(body);
                resolve(parsed);
            }
        });
    });
};

var _apiPostRequest = function _apiPostRequest(url) {
    var formData = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    return new Promise(function (resolve) {
        (0, _request2.default)({ url: url, formData: formData }, function (err, res, body) {
            if (err) {
                resolve(err);
            } else {
                var parsed = JSON.parse(body);
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
 * * **ignorePrestartUpdates** If set, updates dated earlier than when the bot started will be ignored (default: true)
 * @class Bot
 */

var Bot = (function () {
    function Bot(token) {
        var _this = this;

        var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        _classCallCheck(this, Bot);

        if (!token) {
            throw new Error("The token parameter is required. See https://core.telegram.org/bots/api#authorizing-your-bot for more details.");
        }

        this.token = token;
        this.options = Object.assign({}, {
            url: DEFAULT_URL,
            fileUrl: DEFAULT_FILE_URL,
            longPollTimeout: DEFAULT_LONGPOLL_TIMEOUT,
            listenerTimeout: DEFAULT_LISTENER_TIMEOUT,
            ignorePrestartUpdates: DEFAULT_IGNORE_PRESTART_UPDATES
        }, opts);

        this.startTime = Date.now();

        // Full URL with token replaced
        this.url = this.options.url.replace('{token}', this.token);

        // Listeners for new messages/updates
        this.listeners = [];

        // Last update ID, used as an offset for polling updates
        this.lastUpdateId = 0;

        // The bot's ID, username and display name; result of /getMe
        this.info = {};

        this.apiRequest('getMe').then(function (res) {
            if (!res.ok) {
                throw new Error("getMe failed: " + res.description);
            }

            _this.info = res.result;
        }).then(function () {
            var updateHandlerQueue = new _queue.Queue();

            _this.listeners.forEach(function (_ref) {
                var _ref2 = _slicedToArray(_ref, 2);

                var type = _ref2[0];
                var listener = _ref2[1];

                if (type !== 'ready') return;
                listener.call(null, _this);
            });

            _this.pollForUpdates(function (update) {
                // Ignore prestart updates if the option is set
                if (_this.options.ignorePrestartUpdates && update.message) {
                    if (update.message.date < Math.floor(_this.startTime / 1000)) return;
                }
                // "next" and "done" will be supplied by the queue
                updateHandlerQueue.add(_this.callAllListeners.bind(_this, update));
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

    _createClass(Bot, [{
        key: 'apiRequest',
        value: function apiRequest(method) {
            var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

            return _apiRequest(this.url + '/' + method, params);
        }

        /**
         * Sends a POST API request to the specified method
         *
         * @method Bot#apiPostRequest
         * @param  {String} method   Method to call
         * @param  {Object} formData Form data to send along with the request
         * @return {Promise}         A promise that resolves with the result once the API request has finished
         */

    }, {
        key: 'apiPostRequest',
        value: function apiPostRequest(method) {
            var formData = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

            return _apiPostRequest(this.url + '/' + method, formData);
        }

        /**
         * Long-polls for updates from the server
         *
         * @param  {Function} cb Callback to call for each new update
         * @return {Function}    When called, stops the polling
         * @access private
         */

    }, {
        key: 'pollForUpdates',
        value: function pollForUpdates(cb) {
            var _this2 = this;

            var polling = true;

            var pollAgain = function pollAgain() {
                var delay = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

                if (!polling) return;

                setTimeout(function () {
                    _this2.pollForUpdates(cb);
                }, delay);
            };

            this.apiRequest('getUpdates', {
                timeout: this.options.longPollTimeout,
                offset: this.lastUpdateId + 1
            }).then(function (res) {
                if (res instanceof Error) {
                    console.error(res.stack);
                    pollAgain(5000);
                    return;
                }

                if (!res.ok) {
                    console.error(res.description);
                    pollAgain(1000);
                    return;
                }

                var updates = res.result;
                if (updates.length > 0) {
                    _this2.lastUpdateId = updates[updates.length - 1].update_id;
                    updates.forEach(cb);
                }

                pollAgain();
            }).catch(function (err) {
                console.error(err.stack);
                pollAgain(1000);
            });

            return function () {
                polling = false;
            };
        }

        /**
         * Attaches an event listener for the specified event type
         *
         * @param  {String}   event Type of event
         * @param  {Function} cb    Callback to call when the event fires
         * @return {void}
         */

    }, {
        key: 'on',
        value: function on(event, cb) {
            this.listeners.push([event, cb]);
        }

        /**
         * Calls all listeners applicable for the given update
         * 
         * @param  {Object}   update The Telegram update object
         * @param  {Function} next   Will be called after every listener has finished or the command timeout has passed
         * @return {void}
         * @access private
         */

    }, {
        key: 'callAllListeners',
        value: function callAllListeners(update, next) {
            var _this3 = this;

            // We return this queue for the main update queue
            // This ensures updates are handled in order
            var queue = new _queue.Queue();

            queue.finally(function () {
                next();
            });

            var typesToCall = {
                'update': update
            };

            if (update.message) {
                if (update.message.text) typesToCall['text'] = update.message;
                if (update.message.forward_from) typesToCall['forward'] = update.message;
                if (update.message.audio) typesToCall['audio'] = update.message;
                if (update.message.document) typesToCall['document'] = update.message;
                if (update.message.photo) typesToCall['photo'] = update.message;
                if (update.message.sticker) typesToCall['sticker'] = update.message;
                if (update.message.video) typesToCall['video'] = update.message;
                if (update.message.voice) typesToCall['voice'] = update.message;
                if (update.message.contact) typesToCall['contact'] = update.message;
                if (update.message.location) typesToCall['location'] = update.message;
                if (update.message.new_chat_participant) typesToCall['new_chat_participant'] = update.message;
                if (update.message.left_chat_participant) typesToCall['left_chat_participant'] = update.message;
                if (update.message.new_chat_title) typesToCall['new_chat_title'] = update.message;
                if (update.message.new_chat_photo) typesToCall['new_chat_photo'] = update.message;
                if (update.message.delete_chat_photo) typesToCall['delete_chat_photo'] = update.message;
                if (update.message.group_chat_created) typesToCall['group_chat_created'] = update.message;
                if (update.message.supergroup_chat_created) typesToCall['supergroup_chat_created'] = update.message;
                if (update.message.channel_chat_created) typesToCall['channel_chat_created'] = update.message;
                if (update.message.migrate_to_chat_id) typesToCall['migrate_to_chat_id'] = update.message;
                if (update.message.migrate_from_chat_id) typesToCall['migrate_from_chat_id'] = update.message;
            }

            if (update.inline_query) typesToCall['inline_query'] = update.inline_query;
            if (update.chosen_inline_result) typesToCall['chosen_inline_result'] = update.chosen_inline_result;

            this.listeners.forEach(function (_ref3) {
                var _ref4 = _slicedToArray(_ref3, 2);

                var type = _ref4[0];
                var listener = _ref4[1];

                if (!typesToCall[type]) return; // Ignore non-matching listeners

                // queue.add will supply the next and done params
                var call = listener.bind(null, _this3, typesToCall[type]);

                queue.add(call);
            });

            // If all the listeners finish without stopping, stop the queue here
            queue.add(queue.stop.bind(queue));

            // Sometimes listeners forget to call next() or done()
            // In these cases we rely on the timeout so the bot doesn't just stop responding
            if (this.options.listenerTimeout > 0) {
                setTimeout(queue.stop.bind(queue), this.options.listenerTimeout * 1000);
            }
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

    }, {
        key: 'onCommand',
        value: function onCommand() {
            var _this4 = this;

            var args = Array.prototype.slice.call(arguments);
            var cb = args[args.length - 1];
            args = args.slice(0, -1);

            if (typeof cb !== 'function') {
                throw new Error("[Bot::onCommand] Callback required");
            }

            this.on('text', function (bot, message, next, done) {
                var matchedParams = commandMatcher.match.apply(null, [message.text].concat(args).concat(_this4.info.username));

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

    }, {
        key: 'getMe',
        value: function getMe() {
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

    }, {
        key: 'sendMessage',
        value: function sendMessage(chatId, str) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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

    }, {
        key: 'forwardMessage',
        value: function forwardMessage(chatId, fromChatId, messageId) {
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

    }, {
        key: 'sendPhoto',
        value: function sendPhoto(chatId, photo) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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

    }, {
        key: 'sendAudio',
        value: function sendAudio(chatId, audio) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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

    }, {
        key: 'sendDocument',
        value: function sendDocument(chatId, document) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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

    }, {
        key: 'sendSticker',
        value: function sendSticker(chatId, sticker) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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

    }, {
        key: 'sendVideo',
        value: function sendVideo(chatId, video) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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

    }, {
        key: 'sendVoice',
        value: function sendVoice(chatId, voice) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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

    }, {
        key: 'sendLocation',
        value: function sendLocation(chatId, latitude, longitude) {
            var params = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

            var formData = {
                chat_id: chatId,
                latitude: latitude,
                longitude: longitude
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

    }, {
        key: 'sendAction',
        value: function sendAction(chatId, action) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

            var formData = {
                chat_id: chatId,
                action: action
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

    }, {
        key: 'getUserProfilePhotos',
        value: function getUserProfilePhotos(userId) {
            var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

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

    }, {
        key: 'setWebhook',
        value: function setWebhook(url, certificate) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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

    }, {
        key: 'getFile',
        value: function getFile(fileId) {
            return this.apiRequest('getFile', { file_id: fileId });
        }

        /**
         * Returns the URL to the specified file. This URL is valid for at least 1 hour.
         *
         * **More info:** [https://core.telegram.org/bots/api#getfile](https://core.telegram.org/bots/api#getfile)
         *
         * @param  {String} filePath The file path, as returned by getFile
         * @return {String}          The file's URL
         */

    }, {
        key: 'getFileURL',
        value: function getFileURL(filePath) {
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

    }, {
        key: 'answerInlineQuery',
        value: function answerInlineQuery(inlineQueryId, results) {
            var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

            var formData = {
                inline_query_id: inlineQueryId,
                results: typeof results !== 'string' ? JSON.stringify(results) : results
            };

            Object.assign(formData, params);

            return this.apiPostRequest('answerInlineQuery', formData);
        }
    }]);

    return Bot;
})();

exports.Bot = Bot;

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

var paramTypes = {
    WORD: commandMatcher.MATCH_WORD,
    STRING: commandMatcher.MATCH_STRING,
    NUM: commandMatcher.MATCH_NUM,
    REST: commandMatcher.MATCH_REST
};

exports.paramTypes = paramTypes;