var express = require('express'),
    app = module.exports = express(),
    log = require('../logger').add('testmodule'),
    viewengine = require('../viewengine'),
    engine = require('ejs-locals');

viewengine.configure(app, __dirname + '/views');

log.debug('Looking for views from ' + app.get('views'));

app.get('/', function(req, res, next) {
    if (!req.session.user) return next();
    res.render('3xtest');
});