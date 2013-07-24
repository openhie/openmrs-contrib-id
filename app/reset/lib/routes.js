var verification = require('../../verification'),
    ldap = require('../../ldap'),
    log = require('../../logger').add('reset/routes'),
    utils = require('./utils'),
    _ = require('underscore'),
    async = require('async');

_.str = require('underscore.string');

module.exports = {
    showPublicReset: function showPublicReset(req, res, next) {
        res.render('reset-public');
    },

    showPrivateReset: function showPrivateReset(req, res, next) {
        var resetId = req.params.id;

        verification.check(resetId, function(err, valid, locals){
            if (err) {
                return next(err);
            } else if (valid) {
                res.locals.username = locals.username;
                res.render('reset-private');
            } else {
                next();
            }
        });
    },

    beginPasswordReset: function beginPasswordReset(req, res, next) {
        var credential = req.body.resetCredential;

        // Do the gruntwork in this order: Determine whether to look up an email or a
        // user id, look up the user in LDAP, transform the LDAP data into options for
        // verification, and begin email verification for each email address. Phew.
        async.waterfall([

                // Determine how to look up the user.
                function(callback) {
                    utils.determineLookup(credential, callback);
                },

                // Look up the user in LDAP.
                function(lookup, callback) {
                    log.info('Beginning password reset for ' + credential);
                    ldap[lookup](credential, callback);
                },

                function(user, callback) {
                    log.trace('LDAP lookup found user: ' + JSON.stringify(user));
                    utils.transform(user, callback);
                },

                function(options, callback) {
                    log.trace('Password reset data prepared: ' + JSON.stringify(options));

                    // Begin verification for each options object (still a part)
                    // of the above `compose()` line.
                    async.each(options, verification.begin, function(err) {
                        if (err)
                            callback(err);
                        else
                            callback(null);
                    });
                }

            // Once it's all completed:
            ], function(err) {

                if (err) {
                    if (err.message === 'User data not found')
                        log.info('Password reset requested for nonexistent user "'+credential+'"');
                    else
                        return next(err);
                }

                // Finally...
                res.message('info', 'If the specified account exists, an email has been sent '+
                    'to your address(es) with further instructions to reset your password.');
                return res.redirect('/');

            });
    },

    completePasswordReset: function completePasswordReset(req, res, next) {
        var resetId = req.params.id,
            password = req.body.newpassword;

        async.waterfall([
            // Verify the ID is still an active verification session.
            function(callback) {
                log.info('Checking verification id: ' + resetId);
                verification.check(resetId, callback);
            },

            // If this ID was valid, reset the password in LDAP.
            // Otherwise pass a `badPasswordRequest` to the user.
            function(valid, locals, callback) {
                if (valid) {
                    log.info('Resetting password for ' + locals.username);
                    ldap.resetPassword(locals.username, password, callback);
                } else {
                    return next();
                }
            }

        // Once both operations are complete:
        ], function(err) {
            if (err)
                return next(err);
            verification.clear(resetId);
            res.message('success', 'Password has been reset successfully. You may now '+
                'log in across the OpenMRS Community.');
            res.redirect('/');
        });
    },

    badPasswordRequest: function badPasswordRequest(req, res, next) {
        res.message('error', 'The requested password reset has expired or does not exist.');
        res.redirect('/');
    }
};