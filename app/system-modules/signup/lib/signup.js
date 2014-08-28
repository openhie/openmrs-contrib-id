/**
 * This file handles requests related with signup operations
 */
var url = require('url');
var path = require('path');
var botproof = require('./botproof');
var signupMiddleware = require('./middleware');
var async = require('async');
var _ = require('lodash');

var Common = require(global.__commonModule);
var conf = Common.conf;
var app = Common.app;
var log = Common.logger.add('signup');
var mid = Common.mid;
var validate = Common.validate;
var verification = Common.verification;
var nav = Common.userNav;
var utils = Common.utils;

var User = require(path.join(global.__apppath, 'model/user'));

/*
USER-NAV
========
*/
nav.add({
  name: 'Sign Up',
  url: '/signup',
  viewName: 'signup',
  visibleLoggedOut: true,
  visibleLoggedIn: false,
  icon: 'icon-asterisk',
  order: 20
});

/*
ROUTES
======
*/

// get signup from /signup or from / and handle accordingly
app.get(/^\/signup\/?$|^\/$/i, validate.receive, botproof.generators,
  function(req, res, next) {

  if (req.session.user) {
    return next(); // pass onward if a user is signed in
  }

  // parse querystrings for pre-populated data
  var values = res.locals.validation.values || {};
  var renderLayout = true;
  var query = url.parse(req.url, true).query;

  for (var prop in query) {
    if (/^(firstName|lastName|username|primaryEmail|)$/.test(prop)) {
      values[prop] = query[prop];
    }
  }

  // handle layout query string & determine which view to render
  renderLayout = (query.layout === 'false') ? false : true;
  var viewPath = (renderLayout) ? __dirname + '/../views/signup' : __dirname + '/../views/signup-standalone';

  // render the page
  res.render(viewPath, {
    // values: values,
    renderLayout: renderLayout, // allows view to see whether or not it has layout
    bodyAppend: '<script type="text/javascript" src="https://www.google.com/recaptcha/api/challenge?k=' + conf.validation.recaptchaPublic + '"></script>'
  });
});

app.post('/signup', mid.forceLogout, botproof.parsers,
  signupMiddleware.includeEmpties, validate(), function(req, res, next) {
    var id = req.body.username,
      first = req.body.firstname,
      last = req.body.lastname,
      email = req.body.email,
      org = req.body.organization,
      pass = req.body.password,
      captcha = req.body.recaptcha_response_field;

    if (!id || !first || !last || !email || !org || !pass || !captcha) {
      res.send('Unauthorized POST error', {
        'Content-Type': 'text/plain'
      }, 403);
      res.end();
    }

    var id = id.toLowerCase();

    // will be called after account is created and validation process started
    var finishCalls = 0,
      errored = false;
    var finish = function(err) {
      if (err && errored == false) { // handle error
        return next(err);
        errored = true;
      } else {
        finishCalls++;
        if (finishCalls == 2) { // display welcome & verify notification
          req.flash('success', "<p>Thanks and welcome to the OpenHIE Community!</p>" + "<p>Before you can use your ID across our services, we need to verify your email address.</p>" + "<p>We've sent an email to <strong>" + email + "</strong> with instructions to complete the signup process.</p>");
          res.redirect('/signup/verify', 303);
        }
      }
    },
    timeout: 0
  };

  function sendVerificationEmail(callback) {
    log.debug('Sending signup email verification');
    verification.begin(verificationOptions, callback);
  }
  async.series([
    newUser.save.bind(newUser),
    sendVerificationEmail,
  ],
  function (err) {
    if (err) {
      return next(err);
    }
    req.flash('success', '<p>Thanks and welcome to the OpenMRS Community!</p>' +
    '<p>Before you can use your OpenMRS ID across our services, ' +
    'we need to verify your email address.</p>' +
    '<p>We\'ve sent an email to <strong>' + email +
    '</strong> with instructions to complete the signup process.</p>');

    // add the user to ldap
    ldap.addUser(id, first, last, email, pass, function(e, userobj) {
      if (e) finish(e);
      log.info('created account "' + id + '"');

      // lock out the account until it has been verified
      ldap.lockoutUser(id, function(err) {
        if (err) finish(err);
        finish();
      });
    });

    // validate email before completing signup
    verification.begin({
      urlBase: 'signup',
      email: email,
      subject: '[OpenHIE] Welcome to the OpenHIE Community',
      template: path.join(__dirname, '../views/welcome-verify-email.ejs'),
      // template: path.relative(global.__apppath, __dirname+'/../views/welcome-verify-email.ejs'),
      locals: {
        displayName: first + ' ' + last,
        username: id,
        userCredentials: {
          id: id,
          email: email
        }
      },
      timeout: 0
    }, function(err) {
      if (err) finish(err);

      finish();
    });
  });
});

app.get('/signup/verify', function(req, res, next) {
  res.render('signedup');
});

// verification
app.get('/signup/:id', function(req, res, next) {
  var INVALID_MSG = 'The requested signup verification does not exist.';
  var findUsernameByVerifyID = function(callback) {
    verification.check(req.params.id, function (err, valid, locals) {
      if (err) {
        return callback(err);
      }
      if (!valid) {
        return callback({failMessage: INVALID_MSG});
      }
      return callback(null, locals.username);
    });
  };

  // clear locked and expiration flag
  var updateUser = function (user, callback) {
    user.locked = false;
    user.createdAt = undefined;
    user.addGroupsAndSave(conf.user.defaultGroups, callback);
  };

  async.waterfall([
    findUsernameByVerifyID,
    User.findByUsername.bind(User),
    updateUser,
  ],
  function (err, user) {
    if (err) {
      if (err.failMessage) {
        req.flash('error', err.failMessage);
        return res.redirect('/');
      }
      return next(err);
    }
    // we don't have to wait clear
    verification.clear(req.params.id);
    log.debug(user.username + ': account enabled');
    req.flash('success', 'Your account was successfully created. Welcome!');

    req.session.user = user;
    res.redirect('/');
  });
});

// AJAX, check whether or not user exists
app.get('/checkuser/*', function(req, res, next) {
  if (!req.xhr) {
    return res.redirect('/signup');
  }
  var username = req.params[0];
  var isValid = conf.ldap.user.usernameRegex.test(username);

  if (!isValid) {
    return res.end(JSON.stringify({illegal: true}));
  }

  User.findByUsername(username, function chkUser(err, user) {
    if (err) {
      return next(err);
    }
    if (user) {
      return res.end(JSON.stringify({ exists: true}));
    }
    return res.end(JSON.stringify({ exists: false}));
  });
});


// Resource handler
app.get('/signup/resource/*', function(req, res, next) {

  // resolve the path
  var file = path.join(__dirname, '/../resource/', req.params[0]);

  // transmit the file
  res.sendfile(file, function(err) {
    if (err) {
      return next(err);
    }
  });
});
