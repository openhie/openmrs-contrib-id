var express = require('express'),
    app = module.exports = express(),
    viewengine = require('../viewengine'),
    validation = require('../validation'),
    roid = require('../roidutils'),
    routes = require('./lib/routes'),
    utils = require('./lib/utils'),
    usernav = require('../usernav');

// Load helpers.
require('./lib/helpers');

usernav.add({
    "name": "Your Profile",
    "url": "/profile",
    "viewName": "edit-profile",
    "visibleLoggedOut": false,
    "visibleLoggedIn": true,
    "requiredGroup": "dashboard-users",
    "icon" : "icon-user",
    "order": 40
},

{
    "name": "Your Password",
    "url": "/password",
    "viewName": "edit-password",
    "visibleLoggedOut": false,
    "visibleLoggedIn": true,
    "requiredGroup": "dashboard-users",
    "icon": "icon-lock",
    "order": 60
});

viewengine.configure(app, __dirname + '/views');

// Profile updates
app.get('/profile', roid.forceLogin(), validation.receive(),
    utils.emailRender(), routes.showProfile);
app.post('/profile', roid.forceLogin(), express.bodyParser(),
    validation.process(), routes.updateProfile);

// Password updates
app.get('/password', roid.forceLogin(), validation.receive(),
    routes.showPasswordEdit);
app.post('/password', roid.forceLogin(), express.bodyParser(),
    validation.process(), routes.updatePassword);

// Profile Email verificaiton routes
app.get('/profile/email/:id', routes.doEmailVerification);