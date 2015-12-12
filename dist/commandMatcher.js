'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

var MATCH_WORD = '\\s+([^\\s]+)';
var MATCH_STRING = '\\s+((?:".*?")|(?:[^\\s]+))';
var MATCH_NUM = '\\s+(\\-?[1-9][0-9]*)';
var MATCH_REST = '\\s+(.*)';

function matchRaw(str, cmd, params, username) {
    // The command itself
    var regexStr = '^' + cmd + '(?:@' + username + ')?';

    // Specified params
    params.forEach(function (str) {
        regexStr += str;
    });

    regexStr += '$';

    var regex = new RegExp(regexStr);
    var match = str.match(regex);

    if (!match) return null;
    return match.slice(1);
}

/**
 * Matches a command. This function accepts different sets of parameters:
 *
 * (str, cmd, username)
 * (str, cmd, params, username)
 * (str, triggerSymbol, cmd, params, username)
 *
 * @return {null|Array} Matched command parameters or null if there is no match
 */
function match() {
    var args = Array.prototype.slice.call(arguments);

    var str = undefined,
        triggerSymbol = '/',
        cmd = undefined,
        params = [],
        username = "";

    if (args.length === 3) {
        str = args[0];
        cmd = args[1];
        username = args[2];
    } else if (args.length === 4) {
        str = args[0];
        cmd = args[1];
        params = args[2];
        username = args[3];
    } else if (args.length === 5) {
        str = args[0];
        triggerSymbol = args[1];
        cmd = args[2];
        params = args[3];
        username = args[4];
    } else {
        console.log('[AAAA] err');
        throw new Error("[Bot::onCommand] 3-5 parameters required");
    }

    cmd = triggerSymbol + cmd;

    console.log('startsWith:', _typeof(String.prototype.startsWith));
    if (!str.startsWith(triggerSymbol)) return null;

    var paramNames = [];
    var optionalParams = [];
    var dontStripQuotes = {};

    if (params.length > 0 && Array.isArray(params[0])) {
        // Assume named parameters (array of arrays with [name, regex])
        params = params.map(function (paramInfo, i) {
            if (Array.isArray(paramInfo)) {
                // Named param
                paramNames.push(paramInfo[0]);

                if (_typeof(paramInfo[2]) === 'object') {
                    if (paramInfo[2].optional) optionalParams.push(i);
                    if (paramInfo[2].stripQuotes === false) dontStripQuotes[i] = true;
                }

                return paramInfo[1];
            } else {
                // Unnamed param in the middle of named params
                paramNames.push(null);
                return paramInfo;
            }
        });
    }

    var match = undefined;

    match = matchRaw(str, cmd, params, username);
    console.log('match (' + cmd + '):', match);

    if (!match) {
        // If there was no match but there are optional parameters, start removing one optional parameter
        // at a time, starting from the end. Once we get a match, use that.
        if (optionalParams.length > 0) {
            var ignoredSoFar = {};

            for (var i = optionalParams.length - 1; i >= 0; i--) {
                ignoredSoFar[optionalParams[i]] = true;

                var tempParamNames = [],
                    tempParams = [];

                for (var j = 0; j < params.length; j++) {
                    if (ignoredSoFar[j]) continue;
                    tempParamNames.push(paramNames[j]);
                    tempParams.push(params[j]);
                }

                match = matchRaw(str, cmd, tempParams, username);
                if (match) {
                    paramNames = tempParamNames;
                    params = tempParams;
                    break;
                }
            }
        }
    }

    if (!match) return null;

    if (paramNames.length) {
        (function () {
            // Strip quotes
            match = match.map(function (str, i) {
                if (dontStripQuotes[i]) return str;

                if (str[0] === '"' && str[str.length - 1] === '"' || str[0] === "'" && str[str.length - 1] === "'") {
                    str = str.slice(1, str.length - 1);
                }

                return str;
            });

            // Match named parameters
            var matchedNames = {};
            matchedNames['_all'] = match;

            paramNames.forEach(function (name, i) {
                if (name === null) return;
                matchedNames[name] = match[i];
            });

            match = matchedNames;
        })();
    }

    return match;
}

exports.MATCH_WORD = MATCH_WORD;
exports.MATCH_STRING = MATCH_STRING;
exports.MATCH_NUM = MATCH_NUM;
exports.MATCH_REST = MATCH_REST;
exports.match = match;
exports.matchRaw = matchRaw;