var express = require('express'),
    app = module.exports = express(),
    routes = require('./lib/routes'),
    roid = require('../roidutils'),
    validation = require('../validation'),
    viewengine = require('../viewengine');

viewengine.configure(app, __dirname + '/views');

app.get('/login', express.query(), validation.receive(), routes.showLogin);

app.post('/login', roid.forceLogout(), roid.stripNewlines(),
    express.bodyParser(), validation.process(), routes.doLogin);

app.get('/disconnect', routes.doLogout);