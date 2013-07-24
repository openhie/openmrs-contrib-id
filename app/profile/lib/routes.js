var async = require('async'),
    _ = require('underscore'),
    utils = require('./utils'),
    User = require('../../user'),
    db = require('../../db'),
    log = require('../../logger').add('profile/routes'),
    verification = require('../../verification');

module.exports = {
    showProfile: function showProfile(req, res, next) {
        // Email rendering object has already been created through
        // the middleware.

        res.render('edit-profile');
    },

    updateProfile: function(req, res, next) {
        var user = req.session.user;
        var newEmails = utils.changedEmailAddresses(req.body, user);

        log.debug(newEmails);

        // Remove empty lines from the form.
        req.body.emails = _.compact(req.body.emails);

        // Update user's email addresses.
        user.emails = utils.newEmailObjects(req.body, user);

        debugger;

        // Get the new objects belonging to new email addreses.
        var newEmailObjs = _.filter(user.emails, function(email) {
            return _.contains(newEmails, email.address) === true;
        });

        if (newEmails.length) res.message('info', 'Some email addresses ' +
            'need to be verified.');


        async.waterfall([

        // Begin verification of each new email address.
        function(callback) {
            async.each(newEmailObjs, function(email, fn) {
                log.trace('sending verification to ' + email.address);
                var opts = {
                    urlBase: 'profile-email',
                    email: email.address,
                    associatedId: user.username,
                    subject: '[OpenMRS] Email address verification',
                    template: __dirname + '/../views/email/profile-email-verify.hbs',
                    locals: { user: user }
                };
                verification.begin(opts, function(err, inst) {
                    if (err) return fn(err);

                    // Add verification data to user
                    _.findWhere(user.emails, {address: inst.email})
                        .verificationData = {
                            actionId: inst.actionId,
                            verifyId: inst.verifyId,
                            locals: inst.locals,
                            timeoutDate: inst.timeoutDate
                        };
                    fn();
                });
            }, callback);
        },

        // Apply all other properties to the user.
        function(callback) {
            var props = _.pick(req.body, 'firstname', 'lastname');
            user.apply(props).update(callback);
        }

        ], function(err, user) {
            if (err) return next(err);

            res.message('success', 'Profile updated.');
            res.redirect('/profile');
        });
    },

    showPasswordEdit: function(req, res, next) {
        res.render('edit-password');
    },

    updatePassword: function(req, res, next) {
        var user = req.session.user,
            pass = {
                'new': req.body.newpassword,
                'current': req.body.currentpassword
            };

        user.changePassword(pass['new'], pass['current'], function(err) {
            if (err) return next(err);

            log.info(user.username+': password updated');
            res.message('success', 'Password changed.');
            res.redirect('/');
        });
    },

    doEmailVerification: function(req, res, next) {

        var id = req.params.id;
        var user = req.session.user;

        verification.check(id, function(err, isValid, locals) {
            if (err) return next(err);

            // If the verification is correct and unexpired, clear it
            // and ensure the user is logged in.
            if (isValid) {
                var username = locals.associatedId,
                    email = locals.email;

                verification.clear(id);

                // Log in the user if necessary.
                if (user)
                    loggedIn();
                else
                    user = new User(username, loggedIn);
            }

            else {
                res.message('error', 'An email verification for this URL could not be found.');
                res.redirect('/');
            }

            function loggedIn() {

                // Change the user's corresponding email to be verified.
                var emailObj = _.findWhere(user.emails, {address: email});
                emailObj.verified = true;
                emailObj.verificationData = null;
                user.sync();

                // We done.
                res.message('success',
                    'Your email address, ' + email + ' has been verified.');

                res.redirect('/profile');
            }
        });

    }

    /*resendEmailVerification: function(req, res, next) {
        var id = req.params.actionId;
        var user = req.session.user;
        verification.resend(id, function(err, newInst) {
            if (err) return next(err);

            // Update user with new verification data.
            _.findWhere(user.emails, {address: newInst.email})
                .verificationData = {
                    actionId: newInst.actionId,
                    verifyId: newInst.verifyId,
                    locals: newInst.locals,
                    timeoutDate: newInst.timeoutDate
                };

            res.message('success', 'Verification was resent to ' +
                newInst.email + '.');
            res.redirect('/profile');
        });
    },

    cancelEmailVerification: function(req, res, next) {
        var id = req.params.actionId;
        var user = req.session.user;

        async.waterfall([

        function(callback) {
            verification.getByActionId(id, callback);
        },

        function(inst, callback) {
            async.parallel([

                // Return the cancelled email address.
                function(fn) { fn(null, inst.email); },

                // Remove email from the user.
                function(fn) {
                    var thisEmail = _.findWhere(user.emails,
                        { address: inst.email });
                    debugger;
                    user.emails = _.without(user.emails, thisEmail);
                    user.sync(fn);
                },

                // Remove email from the verification system.
                function(fn) {
                    verification.clear(inst.verifyId, fn);
                }

            ], callback);
        }

        ], function(err, results) {
            if (err) return next(err);

            var cancelled = results[0];

            res.message('success',
                'Email verification for "'+cancelled+'" cancelled.');
            res.redirect('/profile');
        });
    }*/


};
