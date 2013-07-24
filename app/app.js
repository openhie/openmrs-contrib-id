/**
 * The contents of this file are subject to the OpenMRS Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://license.openmrs.org
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 *
 * Copyright (C) OpenMRS, LLC.  All Rights Reserved.
 */

// Load libraries.
var express = require('express'),
    app = module.exports = express(),
    MySQLSessionStore = require('connect-mysql-session')(express);

// Try to locate + read configuration.
try {
    var conf = require('./conf');
} catch (e) {
    console.log('ERROR: Configuration failed to load at ('+__dirname+'/conf.js)! Exiting…');
    console.log(e.stack);
    process.exit(1);
}


// Send static resources.
app.use('/resource', express.static('../resource'));
app.get('/favicon.ico', function(req, res, next) {
    // TODO: actually send a favicon favicon
    res.statusCode = 404;
    res.end();
});

// TODO: remove this once globalnav module added
app.get('/globalnav/*', function(req, res, next) {
    res.statusCode = 404;
    res.end();
});

// Establish the session storage mechanism. The user object is loaded into
// each user's session, along with any other state data. It should expire
// along with the login cookie.
app.use(express.cookieParser());
app.use(express.session({
    store: new MySQLSessionStore(conf.db.dbname, conf.db.username, conf.db.password, {
        defaultExpiration: conf.session.duration, // session timeout if browser does not terminate session (1 day)
        logging: false
    }),
    secret: conf.session.secret
}));
// Load app components. Any components should be declared here.
var logger = require('./logger'),
    log = logger.add('app'),
    viewengine = require('./viewengine'),
    usernav = require('./usernav'),
    roid = require('./roidutils'),
    User = require('./user');

// Log HTTP access.
app.use(logger.express);

// Handle session serialization of `User` objects.
app.use(User.middleware);

var root = require('./root'),
    signup = require('./signup'),
    login = require('./login'),
    reset = require('./reset'),
    profile = require('./profile');

app.use(usernav.middleware);
app.use(root);
app.use(signup);
app.use(login);
app.use(reset);
app.use(profile);

// Load handlebars and configure it with application-specific helpers
// and view paths. Handlebars is by default global, so modules can
// render in the same context the core application can.
viewengine.configure(app, __dirname + '/../views3x');

// 404's
app.use(function(req, res, next) {
    next(new roid.HTTPError(404, 'Could not ' + req.method + ' ' + req.originalUrl + '.'));
});

// Determine whether to load production or dev dependencies.
if (app.get('env') === 'production') {
    app.use(function(err, req, res, next) {
        log.error('Caught exception:\n' + err.stack);
        res.locals.error = err;
        res.statusCode = err.status || 500;
        res.render('error');
    });
} else {
    process.stderr.write('Running in development mode. Restart with "NODE_ENV" set to "production" to switch.');
    require('express-debug')(app, {depth: 5});
    app.use(express.errorHandler({showStack: true, dumpExceptions: true}));
}

var port = conf.site.port || 3000;
app.listen(port);
log.info('Express started on port '+port);