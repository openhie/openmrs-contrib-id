var conf = require('../../conf'),
    url = require('url'),
    log = require('../../logger').add('roidutils/middleware');

module.exports = {
    restrictTo: function(role) {
        return function(req, res, next) {
            var fail = function() {
                res.message('error', 'You are not authorized to access this resource.');
                if (req.session.user) {
                    if (req.url=='/') res.redirect(url.resolve(conf.site.url, '/disconnect'));
                    else res.redirect('/');
                }
                else res.redirect(url.resolve(conf.site.url, '/login?destination='+encodeURIComponent(req.url)));
            };

            if (req.session.user) {
                if (req.session.user.groups.indexOf(role) > -1) next();
                else fail();
            }
            else fail();
        };
    },

    forceLogin: function() {
        return function(req, res, next) {
            if (req.session.user) next();
            else {
                log.info('anonymous user: denied access to login-only '+req.url);
                res.message('error', 'You must be logged in to access '+req.url);
                res.redirect(url.resolve(conf.site.url, '/login?destination='+encodeURIComponent(req.url)));
            }
        };
    },

    forceLogout: function() {
        return function(req, res, next) {
            if (req.session.user) {
                log.info(req.session.user.username+': denied access to anonymous-only '+req.url);
                res.message('error', 'You must be logged out to access '+req.url);
                res.redirect('/');
            }
            else next();
        };
    },

    forceCaptcha: function() {
        return function(req, res, next) {
            if (req.body && req.body.recaptcha_challenge_field &&
                req.body.recaptcha_response_field)
                next();
            else {
                // Make captchas empty strings, so they will be validated (and fail).
                // Bwahahaha!
                req.body.recaptcha_challenge_field = "";
                req.body.recaptcha_response_field = "";
                next();
            }
        };
    },

    stripNewlines: function() {
        return function(req, res, next) {
            if (req.body) {
                for (var field in req.body) {
                    req.body[field] = req.body[field].replace(/(\r\n|\n|\r)/gm,"");
                }
            }
            next();
        };
    }
};