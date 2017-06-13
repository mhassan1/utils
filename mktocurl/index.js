"use strict";
var async = require('async');
var Readable = require('stream').Readable;
var stringify = require('streaming-json-stringify');
var fs = require('fs');
var request = require('request');
var Transform = require('stream').Transform;
var json2csv = require('json2csv');
var refreshAccessToken = require('./utils').refreshAccessToken;
var winston = require('winston');
var _ = require('lodash');

var logger = new (winston.Logger)({transports: [new (winston.transports.Console)({timestamp: true, level: 'debug'})]});

logger.info('Starting');

var access_token = 'none';
try {
    access_token = fs.readFileSync('access_token.txt').toString();
} catch (ignore) {}

logger.info('Current Access Token: ' + access_token);

var nextPageToken = process.argv[2];
var stream = new Readable({objectMode: true});
stream._read = function () {};

var fields = fs.readFileSync('./fields.txt').toString().split("\n").splice(1);
var baseFields = ['id', 'updatedAt', 'lastName', 'email', 'createdAt', 'firstName'];
var maxFieldsPerCall = 250;
var outputJsonOrCsv = "csv";  // "csv" or "json"

async.doWhilst(
	function (cb) {
		var baseUrl = 'https://601-cpx-764.mktorest.com/rest/v1/list/5123/leads.json?0=0'; // 0=0 simplifies building URL
        if (nextPageToken) {
            baseUrl += '&nextPageToken=' + nextPageToken;
        }

		var outerResults = [];
		async.each(_.chunk(fields, maxFieldsPerCall), function (chunk, eachCb) {
            var url = baseUrl + '&access_token=' + access_token + '&fields=' + chunk.join(',');
            doGet(url, function (err, results, token) {
                if (err) {
                    eachCb(err);
                } else {
                    nextPageToken = token;
                    results = results.map(function (result) {
                        var stripped = {};
                        Object.keys(result).forEach(function (k) {
                            if (result[k]) {
                                stripped[k] = result[k];
                            }
                        });
                        return stripped;
                    });
                    if (!outerResults.length) {
                        outerResults = results;
                    } else {
                        results.forEach(function (result) {
                            var joinResult = outerResults.find(function (outerResult) {
                                return outerResult.id === result.id;
                            });
                            if (joinResult) {
                                Object.keys(result).forEach(function (k) {
                                    joinResult[k] = result[k];
                                });
                            }
                        });
                    }
                    eachCb();
                }
            });
        }, function (err) {
            if (err) {
                cb(err);
            } else {
                outerResults.forEach(function (result) {
                    stream.push(result);
                });
                cb();
            }
        });
	},
	function () { return !!nextPageToken; },
	function (err) {
		stream.push(null);
		if (err) logger.error(err);
		logger.info('Done');
	}
);

function doGet (url, callback) {
    logger.debug('GET ' + url.substr(0, 300) + '...');
    async.retry({times: 12, interval: 5000}, function (retryCb) {
        request.get({
            url: url,
            json: true,
            timeout: 30000
        }, function (err, resp, body) {
            logger.debug('Got Response');
            if (err) {
                retryCb(err);
            } else if (resp.statusCode !== 200) {
                retryCb('Non-200 Response');
            } else if (!body.result) { // expired token
                logger.debug('Need to refresh access token');
                doRefreshAccessToken(function (err) {
                    if (err) {
                        retryCb(err);
                    } else {
                        doGet(url.replace(/(access_token=)[^&]*([&|$])/, '$1' + access_token + '$2'), retryCb);
                    }
                });
            } else {
                retryCb(null, body.result, body.nextPageToken);
            }
        });
    }, callback);
}

function doRefreshAccessToken (callback) { // this may get called multiple times in parallel if we are executing GETs in parallel, fine for now
    logger.info('Refreshing Access Token...');
    refreshAccessToken(function (err, token) {
        if (err) {
            callback(err);
        } else {
            fs.writeFileSync('access_token.txt', token, { flag : 'w' });
            access_token = token;
            logger.info('Current Access Token: ' + access_token);
            callback();
        }
    });
}

var firstRow = true;
var translateStream = new Transform({writableObjectMode: true});
translateStream._transform = function (data, enc, next) {
    var args = {data: data, hasCSVColumnTitle: firstRow, fields: baseFields.concat(fields)};
    json2csv(args, function (err, csv) {
        if (err) {
            next(new Error(err));
        } else {
            if (firstRow) {
                var rows = csv.split("\n");
                translateStream.push(rows[0] + "\n");
                rows.shift();
                csv = rows.join("\n");
                firstRow = false;
            }
            translateStream.push(csv + "\n");
            next();
        }
    });
};

var i = 0;
while (fs.existsSync('out_' + i + '.' + outputJsonOrCsv)) {
    i++;
}

if (outputJsonOrCsv === "csv") {
    stream
    .pipe(translateStream)
    .pipe(fs.createWriteStream('out_' + i + '.csv'));
} else if (outputJsonOrCsv === "json") {
    stream
    .pipe(stringify())
    .pipe(fs.createWriteStream('out_' + i + '.json'));
} else {
    throw new Error("Invalid outputJsonOrCsv specified.");
}
