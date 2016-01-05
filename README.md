# Telegram Bot API

A simple abstraction for the Telegram Bot API with a powerful command interpreter.

`npm install --save mivir-telegram-bot-api`

## Basic usage
```javascript
var Bot = require('mivir-telegram-bot-api').Bot;
var paramTypes = require('mivir-telegram-bot-api').paramTypes;

var myBot = new Bot('your-bot-token-here');

// Receive a simple text message
myBot.on('text', function(bot, message, next, done) {
    bot.sendMessage(message.chat.id, 'I received your message!');
    next(); // Continue to other listeners
});

// Receive a command
myBot.onCommand('echo', [paramTypes.REST] function(bot, message, params, next, done) {
    bot.sendMessage(message.chat.id, 'Echoing: ' + params[0]);
    done(); // Don't process other listeners for this message anymore
});
```

## Available events for updates
These are the available events for `Bot.on(event, callback)`  
(See example for `'text'` above)

The callback is called with the signature `callback(bot, message, next, done)`  
The parameter `message` equals to `update.message` when available ([Message type definition](https://core.telegram.org/bots/api#message)), with the following exceptions:
* `update` event always passes the whole update object ([Update type definition](https://core.telegram.org/bots/api#update))
* `inline_query` event passes `update.inline_query` ([InlineQuery type definition](https://core.telegram.org/bots/api#inlinequery))
* `chosen_inline_result` event passes `update.chosen_inline_result` ([ChosenInlineResult type definition](https://core.telegram.org/bots/api#choseninlineresult))

Event (string) | Description
---- | ----
update | Any update
text | Any update with `update.message.text`
audio | Any update with `update.message.audio` ([Audio type definition](https://core.telegram.org/bots/api#audio))
document | Any update with `update.message.document` ([Document type definition](https://core.telegram.org/bots/api#document))
photo | Any update with `update.message.photo` ([Photo type definition](https://core.telegram.org/bots/api#photo))
sticker | Any update with `update.message.sticker` ([Sticker type definition](https://core.telegram.org/bots/api#sticker))
video | Any update with `update.message.video` ([Video type definition](https://core.telegram.org/bots/api#video))
voice | Any update with `update.message.voice` ([Voice type definition](https://core.telegram.org/bots/api#voice))
contact | Any update with `update.message.contact` ([Contact type definition](https://core.telegram.org/bots/api#contact))
location | Any update with `update.message.location` ([Location type definition](https://core.telegram.org/bots/api#location))
new_chat_participant | Any update with `update.message.new_chat_participant` ([User type definition](https://core.telegram.org/bots/api#user))
left_chat_participant | Any update with `update.message.left_chat_participant` ([User type definition](https://core.telegram.org/bots/api#user))
new_chat_title | Any update with `update.message.left_chat_participant` (String)
new_chat_photo | Any update with `update.message.new_chat_photo` (Array of [PhotoSize, see definition](https://core.telegram.org/bots/api#photosize))
delete_chat_photo | Any update with `update.message.delete_chat_photo` (`true`; service message)
group_chat_created | Any update with `update.message.group_chat_created` (`true`; service message)
supergroup_chat_created | Any update with `update.message.supergroup_chat_created` (`true`; service message)
channel_chat_created | Any update with `update.message.channel_chat_created` (`true`; service message)
inline_query | Any update with `update.inline_query` ([InlineQuery type definition](https://core.telegram.org/bots/api#inlinequery)) (Read more: [Inline mode](https://core.telegram.org/bots/api#inline-mode)) |
chosen_inline_result | Any update with `update.chosen_inline_result` ([ChosenInlineResult type definition](https://core.telegram.org/bots/api#choseninlineresult))

## Available types for command parameters
```javascript
var paramTypes = require('mivir-telegram-bot-api').paramTypes
```

|Type|Description|
|-|-|
|paramTypes.WORD|Matches any string without whitespace|
|paramTypes.STRING|Matches any string without whitespace OR a double-quote enclosed string (can have whitespace inside the quotes)|
|paramTypes.NUM|Matches a number (including negative numbers and ones with decimals)|
|paramTypes.REST|Matches anything, greedy; useful as a catch-all last parameter (see /echo example above)|

## More examples
```javascript
var Bot = require('mivir-telegram-bot-api').Bot;
var paramTypes = require('mivir-telegram-bot-api').paramTypes;

var myBot = new Bot('your-bot-token-here')

// Respond to /roll <number>
myBot.onCommand('roll', [paramTypes.NUM], function(bot, message, params, next, done) {
    // The param we defined as a number above is now accessible in params[0]
    var rollResult = Math.floor(Math.random() * params[0]);
    bot.sendMessage(message.chat.id, 'Roll result: ' + randomNum);
    done();
});

// Respond to both /random <min> <max> and /random <max>
// Uses named parameters
myBot.onCommand('random', [
    ['num1', paramTypes.NUM],
    ['num2', paramTypes.NUM, {optional: true}]
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

// Respond to !whereis <location> by sending coordinates that show up as a map to Telegram users
myBot.onCommand('!', 'whereis', [paramTypes.STRING], function(bot, message, params, next, done) {
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
