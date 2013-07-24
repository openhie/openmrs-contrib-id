var db = require('../../../db'),
    log = require('../../../logger').add('user/email'),
    Sequelize = db.Sequelize,
    sql = db.direct;

module.exports = sql.define('Email', {
    id: {type: db.INTEGER, primaryKey: true, autoIncrement: true},
    username: db.STRING,
    address: db.STRING,
    primary: db.BOOLEAN,
    verified: db.BOOLEAN,
    verificationData: {
        type: db.TEXT,
        get: function() {
            var data = this.dataValues['verificationData'];
            if (data)
                return JSON.parse(data);
            else
                return undefined;
        },
        set: function(val) {
            if (typeof val === 'object')
                this.dataValues['verificationData'] = JSON.stringify(val);
            else
                this.dataValues['verificationData'] = val;
        }
    }
});