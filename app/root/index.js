var express = require('express'),
    app = module.exports = express(),
    viewengine = require('../viewengine'),
    usernav = require('../usernav'),
    routes = require('./lib/routes');

usernav.add({
    "name": "Welcome",
    "url": "/",
    "viewName": "root",
    "visibleLoggedOut": false,
    "visibleLoggedIn": true,
    "icon": "icon-home", // corresponds with font awesome
    "order": 10
});

viewengine.configure(app, __dirname + '/views');

app.get('/', routes.root);