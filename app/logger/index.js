/**
 * The contents of this file are subject to the OpenMRS Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://license.openmrs.org
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 *
 * Copyright (C) OpenMRS, LLC.  All Rights Reserved.
 */
var log4js = require('log4js'),
    conf = require('../conf');

log4js.loadAppender('console');
log4js.loadAppender('file');
var file = log4js.appenders.file(__dirname + conf.logger.relativePath);

// Redirect console.log() through log4js.
log4js.replaceConsole();
log4js.addAppender(file, 'console');

// Log HTTP access from express.
var express = log4js.getLogger('express'),
    expressPath = log4js.appenders.file(__dirname + conf.logger.accessLog);
log4js.addAppender(expressPath, 'express');


// Call add() to log from any component.
module.exports = {
    logs: [],

    add: function(logname) {
        var l = log4js.getLogger(logname);
        log4js.addAppender(file, logname);

        // use environment specified for Express
        if (process.env.NODE_ENV == 'development') l.setLevel('debug');
        else if (process.env.NODE_ENV == 'production') l.setLevel('info');
        else if (process.env.NODE_ENV == 'trace') l.setLevel('trace');
        else l.setLevel('debug');

        this.logs.push(l);

        return l;
    },

    setLevel: function(level) {
        this.logs.forEach(function(l) {
            l.setLevel(level);
        });
    },

    express: log4js.connectLogger(express)
};