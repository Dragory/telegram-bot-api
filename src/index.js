import request from 'request';

const DEFAULT_URL = "https://api.telegram.org/bot{token}";
const DEFAULT_TIMEOUT = 60;

let poll = (url, params = {}) => {
    return new Promise((resolve, reject) => {
        request({url: url, qs: params}, (err, res, body) => {
            if (! err && res.statusCode === 200) {
                let data = JSON.parse(body);
                resolve(data.result);
            } else {
                reject(err);
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
            timeout: DEFAULT_TIMEOUT
        }, opts);

        this.listeners = {
            "onUpdate": [],
            "onTextMessage": []
        };

        this.lastUpdateId = 0;

        let updateHandlerQueue = Promise.resolve();
        this.pollForUpdates((update) => {
            updateHandlerQueue.then(this.callListeners(update));
        });
    }

    /**
     * Long-polls for updates from the server
     * @param  {Function} cb Callback to call for each new update
     * @return {Function}    Stops polling
     */
    pollForUpdates(cb) {
        let polling = true;
        let updatesUrl = this.options.url.replace('{token}', this.token) + '/getUpdates';

        let pollAgain = (delay = 0) => {
            if (! polling) return;

            setTimeout(() => {
                this.pollForUpdates(cb);
            }, delay);
        };

        poll(updatesUrl, {
            timeout: this.options.timeout,
            offset: this.lastUpdateId + 1
        })
        .then((updates) => {
            if (updates.length > 0) {
                this.lastUpdateId = updates[updates.length - 1].update_id;
                updates.forEach(cb);
            }

            pollAgain(1000);
        })
        .catch((err) => {
            console.error(err);
            pollAgain(1000);
        });

        return () => {
            polling = false;
        };
    }

    onUpdate(cb) {
        this.listeners.onUpdate.push(cb);
    }

    onTextMessage(cb) {
        this.listeners.onTextMessage.push(cb);
    }

    callListeners(update) {
        // We return this promise for the main update queue
        // This ensures updates are handled in order
        return new Promise((resolve) => {
            let queue = Promise.resolve();

            for (let listener of this.listeners.onUpdate) {
                queue.then(new Promise((resolve, reject) => {
                    listener(this, update, resolve, reject);
                }));
            }

            for (let listener of this.listeners.onTextMessage) {
                if (! update.message.text) continue;

                queue.then(new Promise((resolve, reject) => {
                    listener(this, update, resolve, reject);
                }));
            }

            queue.then(resolve);
            queue.catch(resolve);
        });
    }
}

export {Bot as Bot};
