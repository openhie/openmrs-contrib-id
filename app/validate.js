/**
 * The contents of this file are subject to the OpenMRS Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://license.openmrs.org
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 *
 * Copyright (C) OpenMRS, LLC.  All Rights Reserved.
 */

var Recaptcha = require('recaptcha').Recaptcha;
var url = require('url');
var Common = require(global.__commonModule);
var conf = Common.conf;
var ldap = Common.ldap;
var log = Common.logger.add('validation');

module.exports = function(redirect) {

  return function(req, res, next) {
    if (!req.body) {
      return next();
    }

    var b = req.body;
    var user = req.session.user;
    var calls = 1;
    var called = 0;
    var reachedEnd = false;
    var failures = {};
    var failed = false;
    var values = {};
    var failReason = {};

    function fail(field, reason, idx) {
      failed = true;

      if (typeof idx === 'number') {
        if (!failures[field]) {
          failures[field] = [];
        }
        failures[field][idx] = true;
      } else {
        failures[field] = true;
      }

      if (reason) {
        failReason[field] = reason;
      }
      log.debug('validation error in ' + field);
    }

    function notEmpty(field) {
      if (!b[field]) {
        fail(field);
        return false;
      } else {
        return true;
      }
    }

    function finish() {
      called++;
      var isEnd = (called === calls && reachedEnd);
      if (!isEnd) {
        return;
      }

      req.session.validation = {
        failed: true, // ? what's this
        values: values,
        fail: failures,
        failReason: failReason
      };
      if (!failed) {
        return next();
      }

      if (redirect) {
        return res.redirect(redirect); // redirect to predefined destination
      }

      if (req.body.destination) { // redirect to the destination login page
        var to = url.resolve(req.url, '?destination=' +
          encodeURIComponent(req.body.destination)
        );
        return res.redirect(to);
      }

      return res.redirect(req.url); // redirect to generic login page
    }

    for (var field in req.body) {
      values[field] = b[field];

      // only validate if field has been changed,
      // OR if field is not part of user (such as recaptcha validation)
      var noField = (!user || !user[conf.user[field]]);
      var willValidate = (noField || b[field] !== user[conf.user[field]]);
      if (!willValidate) {
        continue;
      }


      if (field === 'username') {
        if (notEmpty(field) && !conf.user.usernameRegex.exec(b[field])) {
          fail(field); // not a legal username
        } else { // check against current usernames
          calls++;
          ldap.getUser.call(this, b[field], function(e, obj) { // ??? `this`
            if (obj) {
              fail(
                'username',
                'This username is already taken. Better luck next time.'
              );
            }
            finish();
          });
        }
        continue;
      }

      if (field == 'email') {
        if (notEmpty(field) && !conf.email.validation.emailRegex.test(b[field])) fail(field); // not an email string
        else if (b[field].indexOf('+') > -1 && !conf.validation.allowPlusInEmail) fail(field, 'Due to incompatibilities with the Google Apps APIs, email addresses cannot contain "+".'); // ensure address doesn't break Google
        else if (conf.email.validation.forceUniquePrimaryEmail) { // force unique email address
          calls++;
          var thisField = field;
          ldap.getUserByEmail(b[field], function(e, obj) {
            if (obj)
              if (!user || (user && user.dn != obj.dn)) fail(thisField, 'This email address is already registered. A unique email address must be provided.');
            finish();
          });
        }
        continue;
      }
      if (field == 'secondaryemail') {
        // treat a single secondary-email list as multiple to keep validation DRY
        if (typeof b[field] == 'string') {
          b[field] = [b[field]];
          values[field] = [b[field]];
        }

        // perform validation
        for (var i = 0; i < b[field].length; i++) {
          if (!b[field][i]) b[field].splice(i, 1); // delete any empty cells
          else {
            if ((!conf.email.validation.emailRegex.test(b[field][i]))) fail(field, undefined, i); // ensure the text entered is an email address

            if (b[field][i].indexOf('+') > -1 && !conf.validation.allowPlusInEmail) fail(field, 'Due to incompatibilities with the Google Apps APIs, email addresses cannot contain "+".', i); // ensure address doesn't break Google

            if (conf.email.validation.forceUniqueSecondaryEmail) { // ensure address is unique
              calls++;
              var thisField = field;
              ldap.getUserByEmail(b[field][i], function(e, obj, call) {
                if (obj) fail(thisField, 'This email address is already registered. A unique email address must be provided.', b[thisField].indexOf(call));
                finish();
              });
            }
          }
        }
        continue;
      }
      if (field == 'password' || field == 'newpassword')
        if (b[field].length < 8) fail(field);
      if (field == 'confirmpassword')
        if (b['newpassword'] != b[field]) fail(field);
      if (field == 'currentpassword') {
        if (!b[field]) fail(field, 'Authentication required to change password.');
        else {
          var currentField = field;
          calls++;
          ldap.authenticate(user[conf.user.username], b[field], function(e) {
            ldap.close(user[conf.user.username]);
            if (e)
              if (e.message == 'Invalid credentials' || e.message == 'Bind requires options: binddn and password') // login failed
                fail(currentField, 'Authentication failed.');
            finish();
          });
        }
      }
      if (field == 'recaptcha_response_field') {
        calls++; // need to wait for the verification callback
        var captchaData = {
            remoteip: req.connection.remoteAddress,
            challenge: req.body.recaptcha_challenge_field,
            response: req.body.recaptcha_response_field
          },
          recaptcha = new Recaptcha(conf.validation.recaptchaPublic, conf.validation.recaptchaPrivate, captchaData);

        recaptcha.verify(function(success, error_code) {
          if (!success) fail('recaptcha_response_field', 'Error: ' + error_code);
          finish();
        });
      }
      if (field == 'firstname' || field == 'lastname' || field == 'loginusername' || field == 'loginpassword')
        notEmpty(field);
    }
    reachedEnd = true;
    finish();
  }
};

// check for validation records (presumably coming from a failed POST that we're
// being redirected from). if any are found, move them to the render variables
module.exports.receive = function receiveValidation() {
  return function(req, res, next) {

    var rs = req.session;
    var rsv = rs.validation;

    if (rs && rsv && Object.keys(rsv).length) {
      res.locals(rsv); // include the properties from validation
      req.session.validation = {};
    }

    next();
  };
};
