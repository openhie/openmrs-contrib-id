var express = require('express'),
    app = module.exports = express(),
    routes = require('./lib/routes'),
    viewengine = require('../viewengine'),
    nav = require('../usernav'),
    roid = require('../roidutils'),
    validation = require('../validation');

nav.add({
    "name": "Sign Up",
    "url": "/signup",
    "viewName": "signup",
    "visibleLoggedOut": true,
    "visibleLoggedIn": false,
    "icon": "icon-asterisk",
    "order": 20
});

// Serve static files.
app.use(express.static(__dirname + '/resource/', '/signup/resource'));

// Configure render engine.
viewengine.configure(app, __dirname + '/views');

// Standard
app.get('/', express.query(), routes.showSignup);
app.get('/signup', roid.forceLogout(), express.query(), validation.receive(), routes.showSignup);
app.get('/signup/verify', routes.showSignupVerify);
app.get('/signup/:id', roid.forceLogout(), routes.verificationCheck);

app.post('/signup', roid.forceLogout(), express.bodyParser(),
    roid.forceCaptcha(), validation.process(), routes.createUser);

app.get('/checkuser/*', routes.checkUsername);