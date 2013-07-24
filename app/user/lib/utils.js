var _ = require('underscore'),
    log = require('../../logger').add('user/utils'),
    conf = require('../../conf');

module.exports = {
    syncEmailEntries: function(inst, callback) {
        var ldapDate = this.convertLdapDate(inst._sources.ldap.modifyTimestamp),
            ldapMail = inst._sources.ldap.mail;

        var dbDate = inst.primaryEmail.updatedAt;

        // Change primary email if LDAP's entry is newer.
        if (ldapDate > dbDate)
            inst.primaryEmail = ldapEmail;

        // Update LDAP + DB with changes.
        inst.sync(callback || function() {});

    },

    // Propagate a User object with data loaded from LDAP and
    // from the `Emails` table. Runs during `user.load`
    extendInstanceWithProperties: function(inst, results) {
        inst._sources = inst._sources || {};
        var ldap = inst._sources.ldap = results[0];
        var emails = inst._sources.emails = results[1];

        var primary = _.findWhere(emails, {primary: true}),
            secondary = _.where(emails, {primary: false});

        inst.username = ldap.uid;
        inst.firstname = ldap.cn;
        inst.lastname = ldap.sn;
        // inst.email = ldap.mail;
        inst.groups = ldap.memberof;

        // inst.secondaryemail = ldap.otherMailbox;

        inst.emails = _.pluck(emails, 'values');

        return inst;
    },

    // Return the LDAP user object with properties of the
    // current user.
    toLdap: function(user) {
        var secEmails = _.where(user.emails, {primary: false, verified: true});

        return _.extend(user._sources.ldap, {
            uid: user.username,
            cn: user.firstname,
            sn: user.lastname,
            displayName: user.displayName,
            mail: user.primaryEmail,
            otherMailbox: _.pluck(secEmails, 'address'),
            memberof: user.groups
        });
    },

    // Convert the string date format that comes out of LDAP
    // into a JS Date object.
    convertLdapDate: function(ldapDate) {
        var s = ldapDate;

        var date = [s.slice(0, 4), s.slice(4, 6),   s.slice(6, 8)  ].join('-');
        var time = [s.slice(8, 10), s.slice(10, 12), s.slice(12, 14)].join(':');

        return new Date(date + s.charAt(14) + time);
    },

    // Returns an object of operations DB needs to do to be in
    // sync. Basically, each element will be an email address, with
    // the word `create`, `update`, or `destroy` based on what the
    // DB must do.
    emailTableOps: function(dbEmails, userEmails) {
        var ops = {};
        userEmails = _.pluck(userEmails, 'address');
        dbEmails = _.pluck(dbEmails, 'address');

        dbEmails.forEach(function(email) {
            if (_.contains(userEmails, email))
                ops[email] = 'update';
            else
                ops[email] = 'destroy';
        });

        userEmails.forEach(function(email) {
            if (!_.contains(dbEmails, email))
                ops[email] = 'create';
        });

        return ops;
    }
};