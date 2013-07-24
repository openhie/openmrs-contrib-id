var express = require('express'),
    app = module.exports = express(),
    viewengine = require('../viewengine'),
    roid = require('../roidutils'),
    validation = require('../validation'),
    usernav = require('../usernav'),
    routes = require('./lib/routes');

usernav.add({
    "name": "Password Reset",
    "url": "/reset",
    "viewName": "reset-public",
    "visibleLoggedOut": true,
    "visibleLoggedIn": false,
    "icon": "icon-unlock",
    "order": 30
});

viewengine.configure(app, __dirname + '/views');

app.get('/reset', roid.forceLogout(), routes.showPublicReset);
app.get('/reset/:id', roid.forceLogout(), validation.receive(),
    routes.showPrivateReset);

app.post('/reset', roid.forceLogout(), express.bodyParser(),
    routes.beginPasswordReset);
app.post('/reset/:id', roid.forceLogout(), express.bodyParser(),
    validation.process(), routes.completePasswordReset);

// The above routes call `next()` down to this method if they get an
// expired/nonexistant verification session.
app.all('/reset/*', roid.forceLogout(), routes.badPasswordRequest);