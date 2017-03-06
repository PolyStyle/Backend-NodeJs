/**
 * Main Server File.
 * To run this, from console:  node node_modules/nodemon/bin/nodemon.js server.js
 * (c) 2015-2017 Nicola Bortignon
 * License: MIT
 */

/*
 * Used to require modules starting from root of the app
 */

global.rootRequire = function(name) {
  return require(__dirname + '/' + name);
}

const HOSTNAME = 'sandbox.yourwebsite.here';
const PORT = 3000;
// Libraries
var path = require('path');
var fs = require('fs-extra');
var util = require('util');
var busboy = require('connect-busboy');
var qs = require('querystring');
var http = require('http');
var async = require('async');
var bodyParser = require('body-parser');
var express = require('express');
var logger = require('morgan');
var request = require('request');
var multipart = require('connect-multiparty');
var expressValidator = require('express-validator');
var useragent = require('express-useragent');

var config = rootRequire('config/config');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var fileUtils = rootRequire('utils/file-utils');
/*
 * Require controllers
 */

/*
 * Require models, here you define all the role relations between objects
 */
var dbProxy = rootRequire('models/model');


// Start using express
var app = express();
// Initiate a http server
var server = require('http').Server(app)
var hostname;
// This is if you want to setup a sendbox URL (in production probably)
// Passed through the enviroment your terminal, or by default.
if (process.env.HOST == undefined) {
  hostname = HOSTNAME;
} else {
  hostname = process.env.HOST;
}



// Declare the door if you have one
app.set('port', process.env.PORT || PORT);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(expressValidator());
app.use(useragent.express());

console.log('🔥: Server Started on ' + hostname +':'+ (process.env.PORT || PORT))
app.use(function(req, res, next) {
  // Website you wish to allow to connect
  // res.setHeader('Access-Control-Allow-Origin', 'http://' + hostname + '/' + (process.env.PORT || 8888));
  // Request methods you wish to allow

  // Todo(mziccard): remove the allow all in prod.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, cache-control, x-requested-with");

  // Pass to next layer of middleware
  next();
});

// Force HTTPS whenver in production
if (app.get('env') === 'production') {
  app.use(function(req, res, next) {
    var protocol = req.get('x-forwarded-proto');
    protocol == 'https' ? next() : res.redirect('https://' + req.hostname + req.url);
  });
}

/* ==========================================================
Use busboy middleware
============================================================ */
app.use(busboy());

/**
 * Root api to check whether the server is up and running
 * TODO: remove
 **/
app.get('/', function(req, res, next) {
  cloudstorage.createSignedUrl("file.txt", "GET", 60, function(err, url) {
    if (err) {
      res.status(404)
      res.json({
        status: 'ERROR',
        message: 'Signed url not found',
        url: url
      });
      return;
    }
    res.json({
      status: 'RUNNING',
      message: 'Server is working fine',
      url: url
    });
  });
});

//D.I.
// Create a Controler and pass the App as dependency injection.

var users = rootRequire('controllers/users.js').controller(app)

// new
var posts = rootRequire('controllers/posts.js').controller(app)
var products = rootRequire('controllers/products.js').controller(app)
var brands = rootRequire('controllers/brands.js').controller(app)
var tags = rootRequire('controllers/tags.js').controller(app)
var images = rootRequire('controllers/images.js').controller(app)

// Old legacy to be removed
var authenticators = rootRequire('controllers/authenticators.js').controller(app)


/**
 * Error handlers have to be defined after all routes
 * development: prints stack traces
 * producetion: does not print stack traces
 **/

if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    console.log(err);
    res.status(err.status || 500);
    res.json({
      status: err.status,
      message: err.message,
      validation: err.validation,
      error: err
    });
  });
} else {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      status: "ERROR",
      message: err.message,
      validation: err.validation,
      error: {}
    });
  });

}

/*
 * Start the server
 */
server.listen(app.get('port'), app.get('host'), function() {
  console.log('😻 Express server has been initialized correctly');
});
