var async = require('async'),
    _ = require('underscore'),
    ldap = require('../../ldap'),
    verification = require('../../verification'),
    log = require('../../logger').add('signup/routes');

module.exports = {
    showSignup: function showSignup(req, res, next) {
        // Send already logged-in users to the Welcome page.
        if (req.session.user)
            return next();

        // Get prefilled user data.
        res.locals.vals = res.locals.vals || {
            username: req.query.username || null,
            firstname: req.query.firstname || null,
            lastname: req.query.lastname || null,
            email: req.query.email || null
        };

        // Change render paramaters if standalone.
        if (req.query.layout === 'false') {
            res.locals.layout = 'standalone';
            res.locals.standalone = true;
        }

        res.render('signup');
    },

    showSignupVerify: function showSignupVerify(req, res, next) {
        res.locals.no_sidebar = true;

        // Get email address used for signup, then clear it.
        res.locals.signup_email = req.session.signupEmail || "the address you registered with";
        req.session.signupEmail = undefined;

        res.render('signedup');
    },

    verificationCheck: function verificationCheck(req, res, next) {
        verification.check(req.params.id, function(err, valid, locals){
            if (err) return next(err);
            if (valid) {
                var user = locals.userCredentials;

                // Enable the account, allowing logins.
                ldap.enableUser(user.id, function(err, userobj){
                    if (err) return next(err);
                    log.debug(user.id+': account enabled');
                    verification.clear(req.params.id);
                    res.message('success', 'Your account was successfully created. Welcome!');

                    // Log in the user
                    req.session.user = userobj;
                    res.redirect('/');
                });
            }
            else {
                res.message('error', 'The requested signup verification does not exist.');
                res.redirect('/');
            }
        });
    },

    createUser: function createUser(req, res, next) {
        // For easy reference.
        var u = {
            id: req.body.username,
            first: req.body.firstname,
            last: req.body.lastname,
            email: req.body.email,
            pass: req.body.password,
            captcha: req.body.recaptcha_response_field
        };

        // Santiy check.
        if (_.size(u) !== 6 || !u.id || !u.first || !u.last ||
            !u.email || !u.pass || !u.captcha) {
            res.send('Unauthorized POST error', { 'Content-Type': 'text/plain' }, 403);
            res.end();
        }

        u.id = u.id.toLowerCase();

        // Start calling the system to create our user. Each
        // function in `waterfall` runs in order and passes
        // its non-error callback arguments to the next one.

        async.waterfall([
            // Create the user.
            function(callback) {
                log.debug('Beginning user creation calls');
                ldap.addUser(u.id, u.first, u.last,
                    u.email, u.pass, callback);
            },

            // Lock out the account until it has been verified.
            function(user, callback) {
                log.info('created account "'+u.id+'"');
                ldap.lockoutUser(u.id, callback);
            },

            // Send email verification
            function(callback) {
                verification.begin({
                    urlBase: 'signup',
                    email: u.email,
                    subject: '[OpenMRS] Welcome to the OpenMRS Community',
                    template: __dirname + '/../views/email/welcome-verify-email',
                    locals: {
                        displayName: u.first + ' ' + u.last,
                        username: u.id,
                        userCredentials: {
                            id: u.id,
                            email: u.email
                        }
                    },
                    timeout: 0
                }, callback);
            }
        ],

        // Called once the waterfall finishes or errors.
        function(err) {
            if (err)
                return next(err);
            log.debug('Signup waterfall complete');

            // Store the email address in-session because /signup/verify needs it
            // to render.
            req.session.signupEmail = u.email;
            res.redirect('/signup/verify', 303);
        });
    },

    // Ajax call -- returns data based on existence
    // of a username
    checkUsername: function checkUsername(req, res, next) {
        if (req.xhr) {
            ldap.getUser(req.params[0], function(err, data){
                if (err) {
                    if (err.message=='User data not found')
                        res.end(JSON.stringify({exists: false}));
                    else if (err.message=='Illegal username specified')
                        res.end(JSON.stringify({illegal: true}));
                    else next(err);
                }
                else if (data)
                    res.end(JSON.stringify({exists: true}));
                else next(err);
            });
        }
        // Redirect if a browser hits this endpoint.
        else
            res.redirect('/signup');
    }
};