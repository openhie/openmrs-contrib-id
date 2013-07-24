#!/usr/bin/env node

var repl = require('repl');

User = require('../');
utils = require('../lib/utils');

e = new User('elliott', function(err) {
    if (err) throw err;

    // e.addEmail('elliott@example.org').verificationData = {laughing: 'cow'};

    repl.start({
        prompt: "> ",
        useGlobal: true
    });

    // setTimeout(function(){
    //     e.sync();
    // }, 1000);

});