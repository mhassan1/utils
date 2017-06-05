"use strict";
var async = require('async');
var Readable = require('stream').Readable;
var stringify = require('streaming-json-stringify');
var fs = require('fs');
var request = require('request');
var Transform = require('stream').Transform;
var json2csv = require('json2csv');
var refreshAccessToken = require('./utils').refreshAccessToken;

var access_token = 'none';
try {
    access_token = fs.readFileSync('access_token.txt').toString();
} catch (ignore) {}

var nextPageToken;
var stream = new Readable({objectMode:true});
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

		var currEndField = 0;
		var currFields = [];
		var outerResults = [];
		async.whilst(
            function () {
                currFields = fields.slice(currEndField, currEndField + maxFieldsPerCall);
                currEndField += maxFieldsPerCall;
                return !!currFields.length;
            },
            function (innerCb) {
                var url = baseUrl + '&access_token=' + access_token + '&fields=' + currFields.join(',');
                doGet(url, function (err, results, token) {
                    if (err) {
                        innerCb(err);
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
                        innerCb();
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
            }
        );
	},
	function () { return !!nextPageToken; },
	function (err) {
		stream.push(null);
		if (err) console.error(err);
		console.log('done');
	}
);

function doGet(url, callback) {
    request.get({
        url: url,
        json: true
    }, function (err, resp, body) {
        if (err) {
            callback(err);
        } else if (resp.statusCode !== 200) {
            callback('Non-200 Response');
        } else if (!body.result) { // expired token
            doRefreshAccessToken(function (err) {
                if (err) {
                    callback(err);
                } else {
                    doGet(url.replace(/(access_token=)[^&]*([&|$])/, '$1' + access_token + '$2'), callback);
                }
            });
        } else {
            console.log(body.nextPageToken);
            console.log(body.result.length);
            callback(null, body.result, body.nextPageToken);
        }
    });
}

function doRefreshAccessToken(callback) {
    console.log('Refreshing Access Token...');
    refreshAccessToken(function (err, token) {
        if (err) {
            callback(err);
        } else {
            fs.writeFileSync('access_token.txt', token, { flag : 'w' });
            access_token = token;
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

if (outputJsonOrCsv === "csv") {
    stream
    .pipe(translateStream)
    .pipe(fs.createWriteStream('out.csv'));
} else if (outputJsonOrCsv === "json") {
    stream
    .pipe(stringify())
    .pipe(fs.createWriteStream('out.json'));
} else {
    throw new Error("Invalid outputJsonOrCsv specified.");
}
