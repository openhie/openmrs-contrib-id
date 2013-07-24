var HTTPError = module.exports = function(status, message) {

    if (arguments.length === 1) {
        message = status;
        status = null;
    }

    this.name = 'HTTPError';
    this.message = message || '';
    this.status = status || 500;
};

HTTPError.prototype = Error.prototype;