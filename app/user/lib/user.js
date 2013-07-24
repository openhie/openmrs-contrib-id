var ldap = require('../../ldap'),
    Email = require('./db/email'),
    conf = require('../../conf'),
    log = require('../../logger').add('user/user'),
    utils = require('./utils'),
    _ = require('underscore'),
    crypto = require('crypto'),
    async = require('async');

var defaultCallback = function(err) {
    if (err) log.error(err);
};

var User = module.exports = function User(username, callback) {
    // Create the properties necessary to manipulate the
    // object.

    // Define "normal" setter and getter methods, that simply
    // set or get a property in `_attributes`.
    User.attributes.forEach(function(attr) {
        Object.defineProperty(this, attr, {
            get: function() {return this._attributes[attr];},
            set: function(val) {this._attributes[attr] = val; },
            enumerable: true
        });
    }.bind(this));

    // Define all other "nonstandard" properties.
    Object.defineProperties(this, {
        mailHash: {
            get: function() {
                if (this._attributes.mailHash) {
                    return this._attributes.mailHash;
                } else if (this.loaded) {
                    var md5 = crypto.createHash('md5');
                    md5.update(this.primaryEmail);
                    this._attributes.mailHash = md5.digest('hex');
                    return this._attributes.mailHash;
                }
            },
            enumerable: true
        },

        displayName: {
            enumerable: true,
            get: function() {
                return this.firstname + ' ' + this.lastname;
            }
        },

        primaryEmail: {
            get: function() {
                var prim = _.findWhere(this.emails, {primary: true});
                return (prim && prim.address) ? prim.address : '';
            },
            set: function(val) {
                var p = _.findWhere(this.emails, {primary: true});
                p.address = val;
                return p;
            },
            enumerable: true
        }
    });

    // Now, load data into the user object.
    this._attributes = {};

    // User object can be created with JSON user data, instead
    // of providing the username and loading manually.
    if (typeof username === 'object') {
        var properties = username;
        for (var p in properties) {
            this[p] = properties[p];
        }
    } else {  // Initialize a new User object.
        log.trace('Creating new User instance for ' + username);

        // Set the username.
        this.username = username;
        this.version = conf.version;
        this.loaded = false;

        // Sync the user.
        this.sync(callback || defaultCallback);
    }

    return this;
};

// All the attributes we're expecting. (They're set)
// in lib/utils)
User.attributes = ['username', 'firstname', 'lastname', 'emails',
    'groups'];

// Get user data from LDAP and the database.
User.prototype.load = function(callback) {
    callback = callback || defaultCallback;

    log.trace('Loading ' + this.username);

    async.parallel([

        // Load LDAP Data
        function(fn) {
            log.trace('Getting LDAP user data');
            ldap.getUser(this.username, fn);
        }.bind(this),

        // Load emails
        function(fn) {
            log.trace('Getting `Emails` DB data');
            Email.findAll({ where: { username: this.username } })
                .complete(fn);
        }.bind(this)

    // Once all are loaded:
    ], function(err, results) {
        if (err)
            return callback(err);

        log.trace('LDAP and email data loaded');

        utils.extendInstanceWithProperties(this, results);

        this.loaded = true;

        callback(null, this);
    }.bind(this));

    return this;
};

User.prototype.update = function(callback) {
    callback = callback || defaultCallback;

    async.parallel([

        // Update LDAP.
        function(callback) {
            ldap.updateUser(utils.toLdap(this), callback);
        }.bind(this),

        // Update `Email` DB Table.
        function(callback) {

            var criteria = { where: {username: this.username} };
            Email.findAll(criteria).success(function(instances) {

                var ops = utils.emailTableOps(instances, this.emails);

                log.trace('email operations for DB: ' + JSON.stringify(ops));

                // For each email, do the actual CRUD task.
                async.each(_.pairs(ops), function(pair, fn) {

                    var email = pair[0], op = pair[1];
                    var inst = _.findWhere(instances, {address: email});

                    var current = _.findWhere(this.emails, {address: email});
                    current = _.omit(current, 'createdAt', 'updatedAt');

                    switch(op) {
                        case 'create':
                            log.trace('creating ' + current.address);
                            Email.create(current).complete(fn);
                            break;
                        case 'update':
                            log.trace('updating ' + current.address);
                            inst.updateAttributes(current).complete(fn);
                            break;
                        case 'destroy':
                            log.trace('destroying ' + inst.address);
                            inst.destroy().complete(fn);
                    }
                }.bind(this), callback);
            }.bind(this));

        }.bind(this)

    ], function(err, results) {
        if (err)
            return callback(err);

        log.trace('Updated user ' + this.username);
        callback(null, this);
    }.bind(this));

    return this;
};

// Either load the user or push changes. NOTE: Doesn't "sync"
// in the traditional sense -- will not merge changes from LDAP
// or DB into the session. This is technically challenging since
// LDAP doesn't track modification times on individual attributes.
User.prototype.sync = function(callback) {
    callback = callback || defaultCallback;

    log.trace('Syncing ' + this.username);
    if (!this.loaded) {
        this.load(callback);
    } else {

        // Update, then reload.
        async.waterfall([
            function(fn) {
                this.update(fn)
            }.bind(this),

            function(user, fn) {
                this.load(fn);
            }.bind(this)

        ], callback);
    }

    return this;
};

// Apply an object of properties to the user. (Useful
// when updating a user).
User.prototype.apply = function(props) {

    // Only apply known properties.
    props = _.pick(props, User.attributes);

    // Apply 'em.
    for (var p in props) {
        this[p] = props[p];
    }

    return this;
};

User.prototype.checkModDate = function(callback) {
    callback = callback || defaultCallback;

    // Get LDAP user object and return its modification date.
    ldap.getUser(this.username, function(err, user) {
        if (err) return callback(err);

        callback(null, utils.convertLdapDate(user.modifyTimestamp));
    });
};

User.prototype.addGroup = function(name) {
    this.groups.push(name);
    return this;
};

User.prototype.removeGroup = function(name) {
    this.groups = _.without(this.groups, name);
    return this;
};


User.prototype.addEmail = function(address, opts) {
    opts = opts || {};

    var email = Email.build({
        username: this.username,
        address: address,
        verified: opts.verified || false
    }).values;
    this.emails.push(email);

    if (opts.primary === true) this.setPrimaryEmail(address);

    return email;
};

// Set a new address as the primary email.
User.prototype.setPrimaryEmail = function(email) {
    if (typeof email === 'object') email = email.address;

    this.emails.forEach(function(email) {
        email.primary = false;
    });

    var primaryEmail = _.findWhere(this.emails, {address: email});
    primaryEmail.primary = true;
    return primaryEmail;
};

User.prototype.isMemberOf = function(group) {
    return _.contains(this.groups, group);
};

User.prototype.changePassword =
    function changePassword(newPassword, current, callback) {
        log.info('Changing password for ' + this.username);
        ldap.changePassword(this, current,
            newPassword, callback);
        return this;
};