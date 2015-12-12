"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Queue = (function () {
    function Queue() {
        _classCallCheck(this, Queue);

        this.items = [];
        this.running = false;
        this.stopped = false;

        this.finallyListeners = [];
    }

    _createClass(Queue, [{
        key: "run",
        value: function run() {
            var _this = this;

            if (this.stopped) return;
            if (this.running) return;
            if (this.items.length === 0) return;

            this.running = true;

            var next = function next() {
                if (_this.stopped) return;

                if (_this.items.length === 0) {
                    _this.running = false;
                    return;
                }

                // Call item with params (next, stop)
                _this.items[0](function () {
                    _this.items.shift();
                    next();
                }, _this.stop.bind(_this));
            };

            next();
        }
    }, {
        key: "stop",
        value: function stop() {
            if (this.stopped) return;

            this.stopped = true;
            this.items = [];
            this.callFinallyListeners();
        }
    }, {
        key: "finally",
        value: function _finally(cb) {
            this.finallyListeners.push(cb);
        }
    }, {
        key: "callFinallyListeners",
        value: function callFinallyListeners() {
            this.finallyListeners.forEach(function (cb) {
                return cb();
            });
        }
    }, {
        key: "add",
        value: function add(item) {
            var run = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

            if (this.stopped) return;

            this.items.push(item);
            if (run) this.run();
        }
    }]);

    return Queue;
})();

exports.Queue = Queue;