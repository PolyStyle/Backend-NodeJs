'use strict';

var config = rootRequire('config/config');
var model = rootRequire('models/model');
var uuidV4 = require('uuid/v4');
var jwt = require('jsonwebtoken');

/**
 * Creates an access token for the provided user ID and a user agent.
 *
 * userId										- The ID of the user
 * userAgent.browser				- The browser from which the request is coming
 * userAgent.version				- The version of the browser from which the request is coming
 * userAgent.os							- The OS from which the request is coming
 * userAgent.platform				- The platform from which the request is coming
 */
function createAccessToken(user, userAgent) {
	return new Promise(function(fullfill, reject) {
		var refreshToken = uuidV4();
		console.log(refreshToken);
		model.AccessToken.create({
			UserId: user.id,
	  	browser: userAgent.browser,
	  	version: userAgent.version,
	  	os: userAgent.os,
	  	platform: userAgent.platform,
	  	refreshToken: refreshToken
		}).then(function(accessToken) {
			console.log("TOKEN CREATED");
			var jwtOptions = {
		    expiresIn: config.TOKEN_EXPIRES_IN,
		    // audience: "", // who will use this token
		    issuer: config.JWT_ISSUER,
		    jwtid: accessToken.id.toString(), // the id of the token, might be useful for blacklisting
		    subject: user.id.toString(),
		  };
		  var tokenUser = {
				id: user.id
		  };
		  var jwtToken = jwt.sign(tokenUser, config.JWT_SECRET, jwtOptions);
		  var returnedAccessToken = {
		  	accessToken: jwtToken,
		  	refreshToken: refreshToken,
		  	expiresIn: config.TOKEN_EXPIRES_IN
		  };
		  console.log(returnedAccessToken);
		  console.log("AFTER ACCESS TOKEN");
			fullfill(returnedAccessToken);
		}).catch(function(databaseError) {
			reject(databaseError);
		});
	});
}

exports.createAccessToken = createAccessToken;

/**
 * Refreshes an access token given the refresh token.
 *
 * userId										- The refresh token
 */
function refreshAccessToken(refreshToken) {
	return new Promise(function(fullfill, reject) {
		model.AccessToken.find({
			refreshToken: refreshToken
		}).then(function(accessToken) {
			if (!accessToken) {
				var err = new Error("Refresh token does not exist");
				reject(err);
			}
			var jwtOptions = {
		    expiresIn: config.TOKEN_EXPIRES_IN,
		    // audience: "", // who will use this token
		    issuer: config.JWT_ISSUER,
		    jwtid: accessToken.id.toString(), // the id of the token, might be useful for blacklisting
		    subject: accessToken.UserId.toString()
		  };
		  var user = {
		  	id: accessToken.UserId
		  };
		  var jwtToken = jwt.sign(user, config.JWT_SECRET, jwtOptions);
		  var returnedAccessToken = {
		  	accessToken: jwtToken,
		  	refreshToken: refreshToken,
		  	expiresIn: config.TOKEN_EXPIRES_IN
		  };
		  fullfill(returnedAccessToken);
		});
	});
}

exports.refreshAccessToken = refreshAccessToken;
