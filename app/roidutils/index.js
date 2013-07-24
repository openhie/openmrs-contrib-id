var _ = require('underscore'),
    conf = require('../conf'),
    HTTPError = require('./lib/httperror'),
    middleware = require('./lib/middleware'),
    log = require('../logger').add('roidutils');

_.extend(module.exports, middleware, {
    'HTTPError': HTTPError
});