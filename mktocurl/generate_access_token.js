"use strict";
var refreshAccessToken = require('./utils').refreshAccessToken;

refreshAccessToken(function (err, token) {
    if (err) {
        console.error(err);
    } else {
        console.log(token);
    }
});
