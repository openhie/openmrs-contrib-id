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

var hbs = require('hbs'),
    _ = require('underscore'),
    async = require('async'),
    helpers = require('./lib/helpers'),
    log = require('../logger').add('viewengine'),
    conf = require('../conf'),
    crypto = require('crypto'),
    fs = require('fs'),
    path = require('path');

// `viewengine` is a module that applies OpenMRS ID's rendering configuration
// to any express application. It's used to configure modules of the
// application similarly. Any of this configuration can be overridden by an app
// locally--just call `app.set()`, etc. after this function.

// Register helper functions to Handlebars, defined in lib/helpers.js.
helpers.register(hbs);

module.exports = {

    // Pass a reference of the global `hbs` and `handlebars` objects.
    hbs: hbs,
    handlebars: hbs.handlebars,

    loadViewEngine: function(app, viewsDir) {
        log.trace('Loading view engine instance with view path ' + viewsDir);

        app.set('view engine', 'hbs');
        app.set('views', viewsDir);

        var partialsDir = path.resolve(viewsDir, 'partials/'),
            sidebarDir = path.resolve(partialsDir, 'sidebar');

        // Load both partials and a sidebar templates, if they exist in this view directory context.
        // We looks for partials in (views)/partials, and sidebars in views/partials/sidebar.
        async.filter([partialsDir, sidebarDir], fs.exists, function(existingDirs) {
            async.each(existingDirs, hbs.registerPartials.bind(hbs), function(err) {
                if (err) log.error(err.stack);
                log.trace("Registered new partials. All partials:\n" + JSON.stringify(hbs.handlebars.partials, null, "  "));
            });
        });
    },

    setRenderConstants: function(app, layoutPath) {
        app.locals({
            layout: layoutPath,
            connected: null,
            defaultSidebar: conf.defaultSidebar,
            about: conf.aboutHTML
        });
    },

    enableRenderHelpers: function(app) {
        app.use(function renderHelpers(req, res, next) {
            var sesh = req.session,
                connected = sesh.user ? true : false;

            res.locals({
                connected: connected,
                user: sesh.user || {}
            });

            next();
        });
    },

    enableMessageHelper: function(app) {
        app.response.message = function(type, msg){
            log.trace("Storing message, " + type + ": " + msg);

            // Reference `req.session` via the `this.req` reference
            var sess = this.req.session;
            // Simply add the msg to an array for later
            sess.messages = sess.messages || [];
            sess.messages.push({type: type, message: msg});
            return this;
        };
        app.use(function messageHelper(req, res, next) {
            var msgs = req.session.messages || [];

            // Set current messages as a render paramater. Combine if
            // there are messages waiting (happens when a major route
            // calls `next` for example).
            if (res.locals.messages)
                res.locals.messages = _.union(res.locals.messages, msgs);
            else
                res.locals.messages = msgs;

            log.trace("Using messages: " + JSON.stringify(res.locals.messages));

            next();

            // Keep messages from building up.
            req.session.messages = [];
        });
    },

    // Run *all* environment configs.
    configure: function(app, viewsDir) {
        // Set a default views directory if necessary.
        viewsDir = viewsDir || path.resolve(__dirname + '/../../views3x/');

        // Detemine path of the *global* layout.
        var layoutPath = path.relative(viewsDir, __dirname + '/../../views3x/layout');

        this.loadViewEngine(app, viewsDir || null);
        this.setRenderConstants(app, layoutPath);
        this.enableRenderHelpers(app);
        this.enableMessageHelper(app);
    }
};