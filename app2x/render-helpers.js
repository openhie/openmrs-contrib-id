var Common = require('./openmrsid-common'),
    log = Common.logger.add('render-helpers'),
    express = require('express');
    conf = Common.conf,
    userNav = Common.userNav,
    url = require('url');

var app = module.exports = express();

// insert our own helpers to be used in rendering
app.locals({
    // reset error validation variables
    // TODO: Still needed in Express 3?
    // clearErrors: function() {
    //     app.locals({failed: false, values: {}, fail: {}, failReason: {}});
    // },

    failed: false, fail: {}, values: {},
    siteURL: conf.siteURL,
    conf: conf,
    url: url
});


var middleware = {
    // flash: function(req, res, next){
    //     // Makes it easier to display flash messages, which are created via req.flash() and erased each page render
    //     return req.flash();
    // },

    loginState: function(req, res, next) {
        log.trace('Checking login state');
        if (req.url != '/favicon.ico') {
            if (req.session.user) {
                var mailHash = crypto.createHash('md5').update(req.session.user.mail).digest('hex');
                app.locals({connected: true, user: req.session.user, mailHash: mailHash});
            }
            else app.locals.connected = false;
        }
        next();
    },

    clear: function(req, res, next){
        log.trace("Clearing application locals");
        // Change undefined variables to default values; keep us from getting "undefined" errors from EJS
        var current = app.locals, replace = {};

        replace.title = (current.title) ? current.title : conf.site.title;
        replace.failed = (current.failed) ? current.failed : false;
        replace.showHeadlineAvatar = (current.showHeadlineAvatar) ? current.showHeadlineAvatar : true;
        replace.showSidebar = (current.showSidebar) ? current.showSidebar : true;

        ['defaultSidebar', 'sidebar'].forEach(function(prop){
            replace[prop] = (current[prop]) ? current[prop] : [];
        });
        ['bodyAppend', 'headAppend', 'headline', 'aboutHTML', 'viewName', 'sentTo', 'emailUpdated'].forEach(function(prop){
            replace[prop] = (current[prop]) ? current[prop] : '';
        });
        ['flash', 'fail', 'values', 'failReason', 'navLinks', 'progress', 'sidebarParams'].forEach(function(prop){
            replace[prop] = (current[prop]) ? current[prop] : {};
        });
        app.locals(replace);
        log.trace('Set application locals');
        next();
    },

    userNavLinks: function(req, res, next){
        log.trace('Determining navigation links');
        // Uses login state and privileges to generate the links to include in the user navigation bar

        var list = userNav.list;
            toRender = [];

        log.trace('userNavLinks: entering for loop');
        if (req.session.user) log.trace('userNavLinks: current groups: '+req.session.user.memberof.toString());

        // Build list of links to display
        list.forEach(function(link){

            // determine if session has access to page
            if (link.requiredGroup) {
                    if (req.session.user && req.session.user.memberof.indexOf(link.requiredGroup) > -1)
                        toRender.push(link);
                    else if (link.visibleLoggedIn) {
                        if (req.session.user) toRender.push(link);
                    }
            }
            if (link.visibleLoggedIn && !link.requiredGroup) {
                if (req.session.user) toRender.push(link);
            }
            if (link.visibleLoggedOut) {
                if (!req.session.user) toRender.push(link);
            }
            next();
        });

        // Sort list by order specified
        toRender.sort(function(a, b){
            return a.order - b.order;
        });

        // Hand the result back to EJS
        app.locals.navLinks = toRender;
    }
};

for (var k in middleware) {
	app.use(middleware[k]);
}