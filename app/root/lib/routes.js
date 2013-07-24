var log = require('../../logger').add('root/routes'),
    _ = require('underscore'),
    https = require('https');

module.exports = {
    root: function root(req, res, next) {
        // Pass through if the user isn't signed in.
        if (!req.session.user) return next();

        // If user is an admin, display the crowd message.
        if (_.contains(req.session.user.groups, 'dashboard-administrators')) {
            var s = res.locals.sidebar;
            if (s)
                s.push('crowd');
            else
                s = ['crowd'];
        }

        // We ping to check for an OSQA account, which controls
        // whether the page says "Create Profile" or "View Profile"
        // under the OSQA section. Weird, isn't it?
        log.trace("Checking for OSQA account");
        https.get({host: 'answers.openmrs.org',
            path: '/users/'+req.session.user.username }, function(httpRes) {
                if (httpRes.statusCode == 200)
                    res.locals.osqaUser = true;
                else
                    res.locals.osqaUser = false;

                log.trace("Rendering after OSQA check");

                res.render('root');
            });
    }
};