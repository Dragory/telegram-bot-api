# Telegram Bot API

A simple abstraction for the Telegram Bot API with a powerful command interpreter.

`npm install --save mivir-telegram-bot-api`

## Example usage
```javascript
var Bot = require('mivir-telegram-bot-api').Bot;
var param = require('mivir-telegram-bot-api').paramTypes;

var myBot = new Bot('your-bot-token-here');

// Receive a simple text message
myBot.on('text', function(bot, message, next, done) {
    console.log('I received a text message:', message.text);
    next(); // Continue to other listeners
});

// Respond to /echo and /echo@username
myBot.onCommand('echo', function(bot, message, params, next, done) {
    bot.sendMessage(message.chat.id, 'Echoing: ' + message.text);
    done(); // Don't process other listeners for this message anymore
});

// Respond to /roll <number>
myBot.onCommand('roll', [param.NUM], function(bot, message, params, next, done) {
    // The param we defined as a number above is now accessible in params[0]
    var rollResult = Math.floor(Math.random() * params[0]);
    bot.sendMessage(message.chat.id, 'Roll result: ' + randomNum);
    done();
});

// Respond to both /random <min> <max> and /random <max>
myBot.onCommand('random', [
    ['num1', param.NUM],
    ['num2', param.NUM, {optional: true}]
], function(bot, message, params, next, done) {
    var min, max;

    if (params.num1 && params.num2) {
        min = params.num1;
        max = params.num2;
    } else {
        min = 0;
        max = params.num1;
    }

    var randomNum = Math.floor(Math.random() * (max - min) + min);
    bot.sendMessage(message.chat.id, 'Random number between ' + min + ' and ' + max + ': ' + randomNum);
    done();
});

// Respond to !whereis <location> by sending coordinates
// that show up as a map to Telegram users
myBot.onCommand('!', 'whereis', [param.STRING], function(bot, message, params, next, done) {
    var location = params[0],
        coords = null;

    if (location.toLowerCase() === 'london') {
        coords = ['51.511072', '-0.127798'];
    }

    if (coords) {
        bot.sendLocation(message.chat.id, coords[0], coords[1]);
    } else {
        bot.sendMessage(message.chat.id, "I don't know :(");
    }

    done();
});
```

## Full API documentation

For full API documentation (generated with JSDOC), see the following URL:

### [https://dragory.github.io/telegram-bot-api/Bot.html](https://dragory.github.io/telegram-bot-api/Bot.html)
