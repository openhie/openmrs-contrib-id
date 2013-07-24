var log = require('../../logger').add('validation/receive');

module.exports = function(){
    return function(req, res, next) {
        if (req.session.validationState) {
            res.locals(req.session.validationState);
            req.session.validationState = null;
        }
        next();
    };
}