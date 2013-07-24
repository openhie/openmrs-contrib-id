// Careful, tiger. This might be totally unnecessary.

var VerifyableEmail = module.exports = function(address) {
    this.address = address;
    this.progress = {};

    Object.defineProperty(this, 'inProgress', {
        enumerable: true,
        get: function() {
            return Object.keys(this.progress).length > 0;
        }
    });
};

VerifyableEmail.prototype = String.prototype;

VerifyableEmail.prototype.toString =
VerifyableEmail.prototype.valueOf = function() {
    return this.address;
};