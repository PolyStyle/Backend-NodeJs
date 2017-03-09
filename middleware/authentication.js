'use strict';

var jwt = require('jsonwebtoken');
var moment = require('moment');

var model = rootRequire('models/model');
var config = rootRequire('config/config');
var reasons = rootRequire('errors/reasons');

/**
 * DEPRECATED: use middleware authentication instead
 */

function ensureAuthenticated(req, res, next) {
  var err;
  if (!req.headers.authorization) {
    err = new Error();
    err.status = 401;
    err.message = 'Please make sure your request has an Authorization header';
    return next(err);
  }
  if (!/^Bearer .*$/.test(req.headers.authorization)) {
    err = new Error();
    err.status = 401;
    err.message = 'Authorization header does not match expected format';
    return next(err);    
  }
  var token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, config.JWT_SECRET, { issuer: config.JWT_ISSUER }, function(jwtError, decoded) {
    if (jwtError) {
      err = new Error();
      err.status = 401;
      err.message = 'Invalid token';
      if (jwtError.name === 'TokenExpiredError') {
        err.reason = reasons.TOKEN_EXPIRED
      }
      err.details = jwtError
      return next(err);
    }
    req.user = decoded.sub;
    //req.scopes = payload.scopes;
    next();
  });
}

exports.ensureAuthenticated = ensureAuthenticated;
