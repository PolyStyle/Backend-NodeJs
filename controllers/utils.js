'use strict';

/**
 * Makes the endpoint return 400 error with an error message explaining that there have been
 * validation errors.
 *
 * errors      - validation errors as returned by express-validator
 * next        - handle to the next step of Express pipeline
 */
function throwValidationError(errors, next) {
  var err = new Error();
  err.status = 400;
  err.message = 'There have been validation errors';
  err.details = errors.array();
  return next(err);
}

exports.throwValidationError = throwValidationError;
