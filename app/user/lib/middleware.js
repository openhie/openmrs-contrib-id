var _ = require('underscore'),
    User = require('./user');

// Properly reconstruct any `User` objects from the session,
// since they've been deserialized from JSON and have lost
// their prototype. (meh)
module.exports = function userMiddleware(req, res, next) {
    if (req.session && req.session.user) {
        var json = req.session.user;
        req.session.user = new User(json);
    }
    next();
};