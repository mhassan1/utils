var async = require('async');

module.exports = function (callback) {
    async.each([1, 2, 3], function (i, cb) {
        setTimeout(cb, 0);
    }, callback);
};