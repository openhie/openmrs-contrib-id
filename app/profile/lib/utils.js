var _ = require('underscore'),
    async = require('async'),
    log = require('../../logger').add('profile/utils'),
    verification = ('../../verification');

module.exports = {

    // Middleware to clone the `user.emails` object and add in
    // some render and validation-specific variables to assist
    // Handlebars with the render.
    emailRender: function() {
        return function(req, res, next) {
            var fail = res.locals.fail || {},
                vals = res.locals.vals || {};

            // Clone user's email objects into local variable.
            var emails = [];
            req.session.user.emails.forEach(function(email) {
                emails.push(_.clone(email));
            });

            // Create objects for new emails that aren't in the user.
            // Give each email address its submitted value.
            if (vals && vals.emails) {
                vals.emails.value.forEach(function(address, i) {
                    emails[i] = emails[i] || {helper: true};
                    emails[i].failValue = address;
                });
            }

            // Mark specific email addresses as failed if needed.
            emails.forEach(function(email, i) {
                i = parseInt(i, 10);
                if (fail.emails &&
                    (fail.emails.index === i || fail.emails.index === null)) {
                        email.failed = { reason: fail.emails.reason };
                }
            });

            // Set this up for render.
            res.locals.emails = emails;

            next();
        };
    },

    // Return an array of changed email addresses.
    changedEmailAddresses: function(form, user) {
        var oldAddresses = _.pluck(user.emails, 'address');
        var newAddresses = form.emails;
        return _.difference(newAddresses, oldAddresses);
    },

    // Return a new `user.emails` array based on the profile form-data.
    // Doesn't replace the data for existing email addresses, only creates
    // new elements for new addresses.
    newEmailObjects: function(form, user) {
        var emails = _.flatten([form.emails]),
            newEmails = [],
            primaryIdx = parseInt(form['primary-email'], 10) || 0,
            primary = form.emails[primaryIdx];

        emails.forEach(function(email, idx) {

            var existing = _.findWhere(user.emails, {address: email});

            if (existing) {
                if (existing.address === primary) existing.primary = true;
                newEmails.push(existing);
            }

            else {
                newEmails.push({
                    username: user.username,
                    address: email,
                    verified: false,

                    // Determine the selected primary email address.
                    primary: idx === primaryIdx ? true : false
                });
            }
        });

        return newEmails;
    },

    // Parse email addresses, and start verification on any new ones.
    // Callback returns an error and an array of EmailVerification instances.
    verifyNewEmails: function(newEmails, callback) {

        async.map(newEmails, function(address, fn) {
            verification.begin({
                urlBase: 'profile-email',
                email: address,
                associatedId: user.username,
                subject: '[OpenMRS] Email address verification',
                template: '../views/email/profile-email-verify.hbs',
                locals: { user: user }
            }, fn);
        }, callback);
    }

};