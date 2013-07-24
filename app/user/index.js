var db = require('../db');

var User = require("./lib/user"),
    middleware = require('./lib/middleware'),
    Email = require('./lib/db/email');

User.middleware = middleware;
User.Email = Email;

module.exports = User;