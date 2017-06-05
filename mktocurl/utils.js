"use strict";
var request = require('request');
var config = require('./config');
module.exports = {
    refreshAccessToken: function (callback) {
        request.get({
            url: 'https://601-cpx-764.mktorest.com/identity/oauth/' +
            'token?grant_type=client_credentials&client_id=' + config.client_id + '&' +
            'client_secret=' + config.client_secret,
            json: true}, function (err, resp, body) {
            if (err) {
                callback(err);
            } else {
                callback(null, body.access_token);
            }
        });
    }
};