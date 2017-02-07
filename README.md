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
myBot.onCommand('echo', [paramTypes.REST], function(bot, message, params, next, done) {
    bot.sendMessage(message.chat.id, 'Echoing: ' + params[0]);
    done(); // Don't process other listeners for this message anymore
});
```

## Events
You can interact with incoming messages by registering **listeners** using `Bot.on(eventType, callback)`. The most basic event type is `'update'` which is called for every update the bot receives. You can see all available event types [below](#user-content-available-event-types).

`callback` is called with the signature `callback(bot, message, next, done)` where `message` equals to `update.message` when available ([Message type definition](https://core.telegram.org/bots/api#message)), with the following exceptions:
* `update` event always passes the whole update object ([Update type definition](https://core.telegram.org/bots/api#update))
* `inline_query` event passes `update.inline_query` ([InlineQuery type definition](https://core.telegram.org/bots/api#inlinequery))
* `chosen_inline_result` event passes `update.chosen_inline_result` ([ChosenInlineResult type definition](https://core.telegram.org/bots/api#choseninlineresult))

Event listeners are placed in a queue and called in the order they are registered.
Once a listener calls `next()`, the next listener is called.
If you've used [Express](http://expressjs.com/), this may feel familiar.
Note that if you don't want other listeners to process the update, you must still call `done()` once you're done. Not calling either, `next()` or `done()`, will result in the bot hanging until the timeout (default 10 seconds) has passed and the queue is cleared again.

## Available event types

Event type (string) | Description
---- | ----
update | Any update
text | Text message, has `message.text`
forward | Forwarded message, has `message.forward_from` and `message.forward_date` ([More information](https://core.telegram.org/bots/api#message))
audio | Playable sound file, has `message.audio` ([Audio type definition](https://core.telegram.org/bots/api#audio))
document | Shared file, has `message.document` ([Document type definition](https://core.telegram.org/bots/api#document))
photo | Image, has `message.photo` ([Photo type definition](https://core.telegram.org/bots/api#photo))
sticker | Sticker, has `message.sticker` ([Sticker type definition](https://core.telegram.org/bots/api#sticker))
video | Video, has `message.video` ([Video type definition](https://core.telegram.org/bots/api#video))
voice | Voice message, has `message.voice` ([Voice type definition](https://core.telegram.org/bots/api#voice))
contact | Shared contact, has `message.contact` ([Contact type definition](https://core.telegram.org/bots/api#contact))
location | Shared location, has `message.location` ([Location type definition](https://core.telegram.org/bots/api#location))
new_chat_participant | System message, a new user joined the chat, has `message.new_chat_participant` ([User type definition](https://core.telegram.org/bots/api#user))
left_chat_participant | System message, a user left the chat, has `message.left_chat_participant` ([User type definition](https://core.telegram.org/bots/api#user))
new_chat_title | Chat title was changed, has `message.new_chat_title` (String)
new_chat_photo | Chat photo was changed, has `message.new_chat_photo` (Array of [PhotoSize, see definition](https://core.telegram.org/bots/api#photosize))
delete_chat_photo | Chat photo was deleted, has  `message.delete_chat_photo` (always `true`)
group_chat_created | A group chat was created, has `message.group_chat_created` (always `true`)
supergroup_chat_created | A supergroup chat was created, has `message.supergroup_chat_created` (always `true`)
channel_chat_created | A channel chat was created, has `message.channel_chat_created` (always `true`)
migrate_to_chat_id | The group has been migrated to a supergroup, has `message.migrate_to_chat_id` (Number)
migrate_from_chat_id | The supergroup has been migrated from a group, has `message.migrate_from_chat_id` (Number)
inline_query | An [inline query](https://core.telegram.org/bots/api#inline-mode), has `update.inline_query` ([InlineQuery type definition](https://core.telegram.org/bots/api#inlinequery)) |
chosen_inline_result | A result was chosen for an inline query, has `update.chosen_inline_result` ([ChosenInlineResult type definition](https://core.telegram.org/bots/api#choseninlineresult))

## Commands
In addition to regular events, the library features an easy to use command interpreter. Commands are registered using `Bot.onCommand` which takes a variable amount of parameters:

* `onCommand(command, listener)`
* `onCommand(command, parameters, listener)`
* `onCommand(prefix, command, parameters, listener)`

Where `command` is the desired `/command` (without a leading slash). A `prefix` can be specified to replace the default `'/'`, but do mind that Telegram only offers auto-completion for commands prefixed with a slash.

`parameters` is an array of [regular expressions](https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions) (as strings). The library provides several constants for common use cases (see below).  
Note that when using a custom regex (not one of the constants), separating whitespace between parameters has to be added manually (e.g. `\s+([a-z]+)`). The first matched capture group of the regex is returned as the value of the parameter.  
You can also name and specify additional options for a parameter by passing is as an array instead: `[name, regex(, options = {})]`. Available options include `optional` (defaults to `false`) and `stripQuotes` (defaults to `true`, strips any double or single quotes around matched parameters).

If the command matches, `callback` is called with the following signature:

`callback(bot, message, parameters, next, done)`

This is otherwise identical to the `'text'` event callback parameters, except for the added `parameters` array. When not using named parameters, `parameters` is simply an array of the matched parameters' values. With named parameters, `parameters` is an object with parameter names as keys and matched values as values. The matched command is always available in `parameters._cmd` and, if using named parameters in conjunction with positional ones, all matched parameter values can be found in `parameters._all`.

## Parameter type constants
```javascript
var paramTypes = require('mivir-telegram-bot-api').paramTypes;

// Accept two parameters, first one a word and the second a number
myBot.onCommand('example', [paramTypes.WORD, paramTypes.NUM], ...);
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

var myBot = new Bot('your-bot-token-here');

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
