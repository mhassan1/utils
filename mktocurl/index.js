var async = require('async');
var Readable = require('stream').Readable;
var stringify = require('streaming-json-stringify');
var fs = require('fs');

var access_token = '';
var next = true;
var nextPageToken;
var stream = new Readable({objectMode:true});
stream._read = function () {};

async.whilst(
	function () { return next; },
	function (cb) {
		var url = 'https://601-cpx-764.mktorest.com/rest/v1/list/5123/leads.json?access_token=' + access_token;
		if (nextPageToken) {
			url += '&nextPageToken=' + nextPageToken;
		}
		request.get({
			url: url,
			json: true
		}, function (err, resp, body) {
			if (err) {
				cb(err);
			} else if (resp.statusCode !== 200) {
				cb('Non-200');
			} else {
				console.log(body.nextPageToken);
				console.log(body.result.length);
				body.result.forEach(function (result) {
					stream.push(result)
				});
				nextPageToken = body.nextPageToken;
				if (!body.nextPageToken) {
					next = false;
				}
				cb();
			}
		});
	},
	function (err) {
		stream.push(null);
		console.log(err);
		console.log('done')
	}
);

stream
.pipe(stringify())
.pipe(fs.createWriteStream('out.json'));
