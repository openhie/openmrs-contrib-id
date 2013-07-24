#!/usr/bin/env node

/* This script migrates the secondary email addresses of OpenMRS ID
 * users to their database-driven format, new as of v2.0. It loads
 * users who possess the `otherMailbox` attribute from LDAP, and copies
 * those addresses into the database table. The `otherMailbox` attributes
 * are left intact, but aren't used by the ID Dashboard.
 */

var ldap = require('ldapjs'),
    async = require('async'),
    _ = require('underscore'),
    _s = require('underscore.string'),
    log4js = require('log4js'),
    User = require('../'),
    conf = require('../../conf'),
    db = require('../../db');

// Disable normal logging
log4js.restoreConsole();
log4js.clearAppenders();

var client = ldap.createClient({
    url: 'ldap://localhost:389',
    maxConnections: 10,
    bindDN: conf.ldap.server.rdn+'='+conf.ldap.server.loginUser+','+conf.ldap.server.baseDn,
    bindCredentials: conf.ldap.server.password
});

var migration = {

    worker: async.cargo(function(instances, callback) {
        async.each(instances, db.update, callback);
    }, 10),

    loaded: 0,
    processed: 0,

    clearTable: function(callback) {
        console.log("Syncing the `Emails` table...");
        db.sync('Email', {force: true}, callback);
    },

    getAllUsers: function(callback) {
        client.search('ou=users,dc=openmrs,dc=org', {
            filter: '(objectClass=inetOrgPerson)',
            scope: 'sub',
            attributes: ['uid', 'mail', 'otherMailbox']
        }, callback);
    },

    receiveSearchResults: function(res, callback) {
        process.stdout.write("Converting LDAP `otherMailbox` attributes " +
            "to `Email` instances...");

        res.on('searchEntry', function(entry) {
            this.loaded++;
            this.printProgressMessage();

            this.worker.push(this.prepareForDatabase(entry), function(err) {
                if (err) return callback(err);
                this.processed++;
                this.printProgressMessage();
            }.bind(this));
        }.bind(this));

        res.on('error', callback);

        res.on('end', function(result) {
            // If there are still tasks in the worker, wait for them.
            if (this.worker.length() > 0) {
                this.worker.drain = function() {
                    callback(null, result);
                };
            } else {
                callback(null, result);
            }
        }.bind(this));
    },

    prepareForDatabase: function(entry) {
        var username = entry.object.uid,
            priEmail  = entry.object.mail,
            secEmails = entry.object.otherMailbox ?
                _.flatten([entry.object.otherMailbox]) : [],
            instances = [];

        // Create an entry for the primary email address...
        var prim = db.create('Email');
        prim.username = username;
        prim.address = priEmail;
        prim.primary = true;
        prim.verified = true;
        instances.push(prim);

        // And for any secondary emails...
        secEmails.forEach(function(email) {
            var inst = db.create('Email');
            inst.username = username;
            inst.address = email;
            inst.primary = false;
            inst.verified = true;
            instances.push(inst);
        });

        return instances;
    },

    printProgressMessage: function() {
        process.stdout.clearLine();
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write("  =>  Found users: " + this.loaded + "\t " +
            "Processed addresses: " + this.processed);
    }
};

_.bindAll(migration, 'getAllUsers', 'receiveSearchResults',
    'prepareForDatabase', 'clearTable', 'printProgressMessage');

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdout.write("Yo. This script will delete all rows in " +
    "the `Emails` table in your database. Continue? [y/n] ");

process.stdin.once('data', function(answer) {
    if (_s.trim(answer).toLowerCase() !== "y")
        process.exit(1);

    async.waterfall([
        migration.clearTable,
        migration.getAllUsers,
        migration.receiveSearchResults
    ], function(err, result) {
        if (err) throw err;

        client.unbind(function() {
            console.log('\nMigration complete!');
            process.exit(0);
        });
    });

});