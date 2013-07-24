var express = require('express'),
    app = module.exports.middleware = express(),
    async = require('async'),
    _ = require('underscore'),
    viewengine = require('../viewengine'),
    log = require('../logger').add('usernav');

/*
This module uses login state and privileges to generate the
links that are included in the user navigation bar.

These links appear on the navigation bar in the order defined.
Modules can add to the list of links by calling add()
*/

// Initialize app
viewengine.configure(app, __dirname + '/views');

module.exports.links = require('./lib/default-links') || [];

app.use(function determineUserNav(req, res, next){
    log.trace('Determining navigation links.');

    // Get a (2-levels-deep) dereferenced copy of the links for manipulation.
    var links = _.map(module.exports.links, function(l) {
        return _.clone(l);
    });

    // Iterator that determines if the client can access a link.
    var shouldRenderLink = function(link, callback){
        if (link.requiredGroup) {
                if (req.session.user && req.session.user.isMemberOf(link.requiredGroup) > -1)
                    return callback(true);
                else
                    return callback(false);
        }
        else {
            if (link.visibleLoggedIn && req.session.user)
                return callback(true);
            else if (link.visibleLoggedOut && !req.session.user)
                return callback(true);
            else
                return callback(false);

        }
        log.debug("I shouldn't be here!");
    };

    // Check which links to render, sort them, and set them to be rendered.
    async.filterSeries(links, shouldRenderLink, function(linksToDisplay) {

        linksToDisplay.sort(function(a, b) {
            return a.order - b.order;
        });

        // Determine if the current page is any of these links
        linksToDisplay.forEach(function(l) {
            if (l.url === req.path)
                l.active = true;
        });

        res.locals.navLinks = linksToDisplay;

        log.trace("Finished determining navigation links");

        next();
    });
});

// Call `add` to insert one or more links into usernav.
module.exports.add = function() {
    var links = Array.prototype.slice.call(arguments);
    links.forEach(function(l) {
        module.exports.links.push(l);
    });
    return links;
};