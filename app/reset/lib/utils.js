var _ = require('underscore'),
    conf = require('../../conf'),
    log = require('../../logger').add('reset/utils');

module.exports = {

    // Determine whether `credential` is an email address or a uid.
    // Returns the name of the LDAP lookup method needed.
    determineLookup: function(credential, callback) {
        // Lookup user by email.
        if (_.str.include(credential, '@'))
            lookup = 'getUserByEmail';
        // Lookup user by username.
        else
            lookup = 'getUser';

        callback(null, lookup);
    },

    // Take a user object from LDAP (`user`), and transform it into
    // and `options` object that can be passed to Verification to
    // send multiple verification emails.
    transform: function(user, callback) {

        var username = user.uid,
            email = user.mail,
            secondaryMail = user.otherMailbox || [];

        // Combine primary and secondary addresses.
        var emails = secondaryMail.concat(email);

        // Get an array of Verification options (one per email).
        var options = _.map(emails, function(address) {
            return {
                urlBase: 'reset',
                email: address,
                subject: '[OpenMRS] Password Reset for '+username,
                template: __dirname + '/../views/email/password-reset',
                locals: {
                    username: username,
                    displayName: user.displayName,
                    allEmails: emails
                },
                timeout: conf.ldap.user.passwordResetTimeout
            };
        });

        callback(null, options);
    }

};