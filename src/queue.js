class Queue {
    constructor() {
        this.items = [];
        this.running = false;
        this.stopped = false;

        this.finallyListeners = [];
    }

    run() {
        if (this.stopped) return;
        if (this.running) return;
        if (this.items.length === 0) return;

        this.running = true;

        let next = () => {
            if (this.stopped) return;

            if (this.items.length === 0) {
                this.running = false;
                return;
            }

            // Call item with params (next, stop)
            this.items[0](() => {
                this.items.shift();
                next();
            }, this.stop.bind(this));
        };

        next();
    }

    stop() {
        if (this.stopped) return;

        this.stopped = true;
        this.items = [];
        this.callFinallyListeners();
    }

    finally(cb) {
        this.finallyListeners.push(cb);
    }

    callFinallyListeners() {
        this.finallyListeners.forEach((cb) => cb());
    }

    add(item, run = true) {
        if (this.stopped) return;

        this.items.push(item);
        if (run) this.run();
    }
}

export {Queue as Queue};
