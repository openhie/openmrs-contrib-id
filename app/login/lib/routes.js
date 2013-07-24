var async = require('async'),
    url = require('url'),
    User = require('../../user'),
    log = require('../../logger').add('login/routes'),
    ldap = require('../../ldap'),
    conf = require('../../conf');

module.exports = {
    showLogin: function showLogin(req, res, next) {
        res.render('login');
    },

    doLogin: function doLogin(req, res, next) {
        var username = req.body.loginusername,
            password = req.body.loginpassword,
            redirect = req.body.destination || '/';

        async.waterfall(
            [
                // Try to authenticate with this user+pass.
                function(callback) {
                    ldap.authenticate(username, password, callback);
                },

                // Close the auth check and load user data
                function(callback) {
                    log.info(username+': authenticated');
                    ldap.close(username);

                    var u = new User(username, callback);
                }
            ],

            function(err, user) {
                if (err && err.message == 'Invalid credentials') {
                    log.info('authentication failed for "'+username+'" ('+err.message+')');

                    // Display a login failed message and
                    // mark the fields for review.
                    res.message('error', 'Login failed. The username or password was incorrect.');
                    res.locals({
                        fail: {
                            loginusername: {value: username},
                            loginpassword: {}
                        },
                        values: {
                            loginusername: username
                        }
                    });

                    // Redirect to the login page, including destination.
                    if (req.body.destination)
                        return res.redirect(url.resolve(conf.site.url, '/login?destination='+
                            encodeURIComponent(req.body.destination)));
                    else
                        return res.redirect(url.resolve(conf.site.url, '/login'));
                } else if (err)
                    return next(err);

                // At this point, login did complete successfully!
                req.session.user = user;
                log.debug('User '+user.username+' stored in session');
                res.redirect(url.resolve(conf.site.url, decodeURIComponent(redirect)));
            });

    },

    doLogout: function doLogout(req, res, next) {
        if (req.session.user) {
            log.info(req.session.user.username+': disconnecting');
            req.session.user = undefined;
        }
        res.redirect('/');
    }
};