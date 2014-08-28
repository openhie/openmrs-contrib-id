/**
 * This file handles the password-reset functionalities
 */

var path = require('path');
var async = require('async');
var _ = require('lodash');

var settings = require('../settings');
var resetMid = require('../middleware');

var Common = require(global.__commonModule);
var app = Common.app;
var conf = Common.conf;
var mid = Common.mid;
var validate = Common.validate;
var verification = Common.verification;
var log = Common.logger.add('express');
var utils = Common.utils;


var User = require(path.join(global.__apppath, 'model/user'));

app.get('/reset', mid.forceLogout, function(req, res, next) {
  res.render(path.join(settings.viewPath, 'reset-public'));
});

app.post('/reset', mid.forceLogout, function(req, res, next) {
  // case-insensitive
  var resetCredential = req.body.resetCredential.toLowerCase();
  var USER_NOT_FOUND_MSG = 'User data not found';

  var filter = {};
  if (resetCredential.indexOf('@') < 0) {
    filter.username = resetCredential;
  } else {
    filter.emailList = resetCredential;
  }


  var findUser = function (callback) {
    User.findByFilter(filter, function (err, user) {
      if (err) {
        return callback(err);
      }
      if (_.isEmpty(user)) {
        log.info('reset requested for nonexistent user "' +
          resetCredential + '"');
        return callback(new Error(USER_NOT_FOUND_MSG));
      }
      callback(null, user);
    });
  };

  var sendEmails = function (user, callback) {
    var username = user.username;
    var emails = user.emailList;

    var sendEmail = function (address, cb) {
      verification.begin({
        urlBase: 'reset',
        email: address,
        subject: '[OpenHIE] Password Reset for ' + username,
        template: path.join(settings.viewPath, 'email/password-reset.ejs'),
        locals: {
          username: username,
          displayName: user.displayName,
          allEmails: emails
        },
        timeout: conf.ldap.user.passwordResetTimeout
      }, cb);
    };
    async.each(emails, sendEmail, callback);
  };

  async.waterfall([
    findUser,
    sendEmails,
  ],
  function (err) {
    if (err && err.message !== USER_NOT_FOUND_MSG) {
      return next(err);
    }
    req.flash('info', 'If the specified account exists,' +
      ' an email has been sent to your address(es) ' +
      'with further instructions to reset your password.');
    return res.redirect('/');
  });
});

app.get('/reset/:id', mid.forceLogout, validate.receive,
  function(req, res, next) {

  var resetId = req.params.id;
  verification.check(resetId, function(err, valid, locals) {
    if (err) {
      return next(err);
    }
    if (valid) {
      res.render(path.join(settings.viewPath, 'reset-private'), {
        username: locals.username
      });
    } else {
      req.flash('error',
        'The requested password reset has expired or does not exist.');
      res.redirect('/');
    }
  });
});

app.post('/reset/:id', mid.forceLogout, resetMid.validator,
  function(req, res, next) {

  verification.check(req.params.id, function(err, valid, locals) {
    if (err) {
      return next(err);
    }
    if (!valid) {
      req.flash('error',
        'The requested password reset has expired or does not exist.');
      return res.redirect('/');
    }

    var password = req.body.newPassword;
    var username = locals.username;

    User.findByUsername(username, function (err, user) {
      if (err) {
        return next(err);
      }
      user.password=password;

      user.save(function (err) {
        if (err) {
          log.error('password reset failed');
          return next(err);
        }
        log.info('password reset for "' + username + '"');
        verification.clear(req.params.id); // remove validation from DB
        req.flash('success', 'Password has been reset successfully. ' +
          'You may now log in across the OpenHIE Community.');
        res.redirect('/');
      });
    });
  });
});
