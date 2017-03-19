'use strict';

var fs = require('fs-extra');
var geoip = require('geoip-lite');
var facebook = require('fb');
var request = require('request');
var jwt = require('jsonwebtoken');

var fileUtils = rootRequire('utils/file-utils');
var authentication = rootRequire('middleware/authentication');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var config = rootRequire('config/config');
var imageModel = rootRequire('models/images');
var cdn = rootRequire('libs/cdn/cloudstorage');
var accessTokens = rootRequire('models/access-tokens');
var controllerUtils = rootRequire('controllers/utils');

facebook.options({
    appId:          config.FACEBOOK_APP_ID,
    appSecret:      config.FACEBOOK_APP_SECRET,
});

module.exports.controller = function(app) {

  /**
   * Creates or logs a user in given a Facebook access token.
   *
   * req.body.accessToken      - The facebook access token
   *
   * Returns:
   * On Success               - A JSON object containing the following fields:
   *                            id                        - the id of the user
   *                            email                     - the user's email
   *                            firstName                 - first name of the user
   *                            lastName                  - last name of the user
   *                            gender                    - the gender of the user, if set
   *                            avatar                    - the id of the user's avatar
   *                            role                      - the role of the user in the system
   *                            accessToken.accessToken   - a JWT token for the current user
   *                            accessToken.refreshToken  - a token to refresh the JWT
   *                            accessToken.expiresIn     - time in seconds before the JWT expires
   *
   * On Error                 - A JSON object containing the following fields
   *                            status  - HTTP status code
   *                            message - Human readable error message
   *                            details - Error details (optional)
   *
   * Test with CURL:
   * curl -H "Content-Type: application/json" -X POST -d "{\"accessToken\":\"FACEBOOK_ACCESS_TOKEN\"}" localhost:3000/users/login/facebook
   */
  app.post('/users/login/facebook', function(req, res, next) {
    req.checkBody('accessToken', 'Missing FB access token').notEmpty();
    req.getValidationResult().then(function(result) {
      if (result && !result.isEmpty()) {
        return controllerUtils.throwValidationError(result, next);
      }
      var accessToken = req.body.accessToken;
      var parameters = {
        access_token: accessToken,
        fields: config.FACEBOOK_PROFILE_FIELDS
      };
      facebook.api('me', parameters, function (response) {
        if(!response || response.error) {
          console.log(!res ? 'error occurred' : response.error);
          var err = new Error();
          err.status = 404;
          err.message = 'Failed to access FB profile';
          err.details = response.err;
          return next(err);
        }
        model.User.findOrCreate({
          where: {
            email: response.email
          },
          defaults: {
            email: response.email,
            firstName: response.first_name,
            lastName: response.last_name,
            gender: response.gender,
            facebookToken: accessToken
          }
        }).spread(function(user, created) {
          console.log(user);

          // Move profile picture to CDN
          if (response.picture && response.picture.data && response.picture.data.url) {
            // We can afford to ignore exceptions for profile pic upload
            imageModel.createImageFromUrl(response.picture.data.url, '.jpg', 50, 50).then(function(image) {
              user.ImageId = image.id;
              user.save();
            });
          }

          // Create our access token
          accessTokens.createAccessToken(user, req.useragent).then(function(accessToken) {
            var userToReturn = {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              gender: user.gender,
              ImageId: user.ImageId,
              role: user.role,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              accessToken: accessToken
            };
            return res.send(JSON.stringify(userToReturn));
          }).catch(function(accessTokenError) {
            var err = new Error();
            err.status = 500;
            err.message = 'Failed to create access token';
            err.details = databaseError;
            return next(err);
          });
        }).catch(function(databaseError) {
          var err = new Error();
          err.status = 500;
          err.message = 'Failed to create user in DB';
          err.details = databaseError;
          return next(err);
        });
      });
    });
  });

  /**
   * Returns the profile of the authenticated user.
   *
   * req.headers.authorization     - The user's access token in the form "Bearer: ACCESS_TOKEN"
   *
   * Returns:
   * On Success               - A JSON object containing the following fields:
   *                            id            - the id of the user
   *                            email         - the user's email
   *                            firstName     - first name of the user
   *                            lastName      - last name of the user
   *                            gender        - the gender of the user, if set
   *                            avatar        - the id of the user's avatar
   *                            role          - the role of the user in the system
   *
   * On Error                 - A JSON object containing the following fields
   *                            status  - HTTP status code
   *                            message - Human readable error message
   *                            details - Error details (optional)
   *
   * Test with CURL:
   * curl -H "Authorization: Bearer ACCESS_TOKEN" localhost:3000/users/me
   */
  app.get('/users/me', authentication.ensureAuthenticated, function(req, res, next) {
    model.User.findById(req.user).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'User was not found';
        err.details = databaseError;
        return next(err);
      }
      var userToReturn = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        gender: user.gender,
        imageId: user.ImageId,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
      res.send(JSON.stringify(userToReturn));
    }).catch(function(databseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to create user in DB';
      err.details = databaseError;
      return next(err);
    });
  });

  /**
   * Returns a new access token for the provided refresh token.
   *
   * req.body.refreshToken    - The user's access token in the form "Bearer: ACCESS_TOKEN"
   *
   * Returns:
   * On Success               - A JSON object containing the following fields:
   *                            accessToken   - a JWT token for the current user
   *                            refreshToken  - a token to refresh the JWT
   *                            expiresIn     - time in seconds before the JWT expires
   *
   * On Error                 - A JSON object containing the following fields
   *                            status  - HTTP status code
   *                            message - Human readable error message
   *                            details - Error details (optional)
   *
   * Test with CURL:
   * curl -H "Content-Type: application/json" -X POST -d "{\"refreshToken\":\"ACCESS_TOKEN\"}" localhost:3000/users/me/token
   */
  app.post('/users/me/token', function(req, res, next) {
    req.checkBody('refreshToken', 'Missing refresh token').notEmpty();
    req.getValidationResult().then(function(result) {
      if (result && !result.isEmpty()) {
        return controllerUtils.throwValidationError(result, next);
      }
      accessTokens.refreshAccessToken(req.body.refreshToken).then(function(accessToken) {
        return res.send(JSON.stringify(accessToken));
      }).catch(function(error) {
        err.status = 400;
        return next(err);
      });
    });
  });

  /**
   * GET /me
   * Get authenticated user profile information
   */
  app.get('/me/cart',
    authentication.ensureAuthenticated,
    function(req, res) {

      model.User.find({
        where: {
          id: req.user
        }
      }).then(function(user) {

        user.getCartItems({
          include: [{
            model: model.Track,
            include: [{
              model: model.Artist,
              as: 'Producer'
            },{model: model.Release,
              include: model.Label
            }]
          }, {
            model: model.Release,
            include: [{
              model: model.Track
            },{
              model: model.Label
            }]
          }]
        }).then(function(items) {
          res.send(items);
        });
      });
    });

  /**
   * GET /me
   * Get authenticated user profile information
   */
  app.get('/me/cart',
    authentication.ensureAuthenticated,
    function(req, res) {

      model.User.find({
        where: {
          id: req.user
        }
      }).then(function(user) {

        user.getCartItems({
          include: [{
            model: model.Track,
            include: [{
              model: model.Artist,
              as: 'Producer'
            },{model: model.Release,
              include: model.Label
            }]
          }, {
            model: model.Release,
            include: [{
              model: model.Track
            },{
              model: model.Label
            }]
          }]
        }).then(function(items) {
          res.send(items);
        });
      });
    });

  /**
   * GET '/me/cart/currency'
   * Get user's currency based on geolocalization
   */
  app.get('/me/cart/currency', function(req, res) {
    // QUESTION:  shall we change CURRENCY at every connection ?
    // A User that lives in london, is traveling to US, which currency shall we
    // display? So far we geolocalize every request
    var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;

    var geo = geoip.lookup(ip);
    var country = 'US';
    if (geo) {
      country = geo.country;
    }
    console.log('country' + country);
    console.log('geo');
    console.log(geo);
    model.Internationalization.find({
      where: {
        country: country
      },
      include: [{
        model: model.Currency,
        include: {
          model: model.ConvertedPrice
        }
      }]
    }).then(function(country) {
      if (country) {
        res.send(country.Currency);
      } else {
        model.Currency.find({
          where: {
            shortname: model.DefaultCurrency
          },
          include: {
            model: model.ConvertedPrice
          }
        }).then(function(currency) {
          res.send(currency);
        });
      }
    });
  });

  /**
   * POST /me/cart/release/:id
   * Add a Release to the Cart
   */
  app.post('/me/cart/release/:id',
    authentication.ensureAuthenticated,
    function(req, res) {

      var releaseId = req.params.id;
      model.User.find({
        where: {
          id: req.user
        }
      }).then(function(user) {
        if (!user) {
          return res.status(400).send({
            message: 'User not found'
          });
        }

        model.CartItem.create({
          UserId: req.user,
          ReleaseId: releaseId
        }).then(function(createdItem) {
          // TODO (@ziccard): refactor the following code.
          // Is it possible to have as the return object the Item
          // with all the inclusion executed?


          model.CartItem.find({
            where: {
              id: createdItem.id
            },
            include: [{
              model: model.Track,
              include: [{
                model: model.Artist,
                as: 'Producer'
              },{model: model.Release,
                include: model.Label
              }]
            }, {
              model: model.Release,
              include: [{
                model: model.Track
              },{
                model: model.Label
              }]
            }]
          }).then(function(items) {
            res.send(items);
          });



        });
      });
    });

  /**
   * POST /me/cart/track/:id
   * Add a Track to the Cart
   */
  app.post('/me/cart/track/:id',
    authentication.ensureAuthenticated,
    function(req, res) {
      var trackId = req.params.id;
      model.User.find({
        where: {
          id: req.user
        }
      }).then(function(user) {
        if (!user) {
          return res.status(400).send({
            message: 'User not found'
          });
        }

        model.CartItem.create({
          UserId: req.user,
          TrackId: trackId
        }).then(function(item) {


          // TODO (@ziccard): refactor the following code.
          // Is it possible to have as the return object the Item
          // with all the inclusion executed?


          model.CartItem.find({
            where: {
              id: item.id
            },
            include: [{
              model: model.Track,
              include: [{
                model: model.Artist,
                as: 'Producer'
              },{model: model.Release,
                include: model.Label
              }]
            }, {
              model: model.Release,
              include: [{
                model: model.Track
              },{
                model: model.Label
              }]
            }]
          }).then(function(items) {
            res.send(items);
          });




        });
      });
    });

  /**
   * DELETE /me/cart/track/:id
   * Remove a Track from the Cart
   */
  app.delete('/me/cart/track/:id',
    authentication.ensureAuthenticated,
    function(req, res) {
      var trackId = req.params.id;
      console.log('DELETE TRACK');
      model.CartItem.findOne({
        where: {
          UserId: req.user,
          TrackId: trackId
        }
      }).then(function(cartItem) {
        cartItem.destroy().then(function() {
          res.send();
        });
      });
    });

  /**
   * DELETE /me/cart/track/:id
   * Remove a Release from the Cart
   */
  app.delete('/me/cart/release/:id',
    authentication.ensureAuthenticated,
    function(req, res) {
      var releaseId = req.params.id;
      console.log('DELETE RELEASE');
      model.CartItem.findOne({
        where: {
          UserId: req.user,
          ReleaseId: releaseId
        }
      }).then(function(cartItem) {
        cartItem.destroy().then(function() {
          res.send();
        });
        console.log(cartItem);
      });
    });

  /**
   * GET /me/library
   * Get authenticated user library
   */
  app.get('/me/library',
    authentication.ensureAuthenticated,
    function(req, res) {

      model.LibraryItem.findAll({
        include: [{
          model: model.Track,
          include: [{
            model: model.Artist,
            as: 'Producer'
          }],
        }],
        where: {
          UserId: req.user
        }
      }).then(function(itemLists) {
        res.send(itemLists);
      });
    });


  /**
   * PUT /api/me
   * Update the authenticated user profile information
   */
  app.put('/me',
    authentication.ensureAuthenticated,
    function(req, res, next) {
      model.User.find({
        where: {
          id: req.user
        }
      }).then(function(user) {
        if (!user) {
          return res.status(400).send({
            message: 'User not found'
          });
        }
        user.displayName = req.body.displayName || user.displayName;
        user.email = req.body.email || user.email;
        user.save(function(err) {
          if (err) {
            return next(err);
          }
          res.status(200).end();
        });
      });
    });

  /**
   * POST /upload/profilePicture/:width/:height/
   * Upload user profile picture to the CDN, original size and resized
   */
  app.post('/upload/profilePicture/:width/:height/',
    authentication.ensureAuthenticated,
    fileUtils.uploadFunction(
      fileUtils.localImagePath,
      fileUtils.remoteImagePath),
    fileUtils.resizeFunction(
      fileUtils.localImagePath,
      fileUtils.remoteImagePath),
    function(req, res, next) {

      model.User.find({
        where: {
          id: req.user
        }
      }).then(function(user) {
        if (!user) {
          var err = new Error();
          err.status = 404;
          err.message = 'Could not find user';
          return next(err);
        }
        // We store CDN address as avatar
        var oldAvatar = user.avatar;
        var oldFullSizeAvatar = user.fullSizeAvatar;
        user.avatar =
          fileUtils.remoteImagePath(req, req.uploadedFile[0].resizedFilename);
        user.fullSizeAvatar =
          fileUtils.remoteImagePath(req, req.uploadedFile[0].filename);
        user.save().then(function(user) {
          if (!user) {
            var err = new Error();
            err.status = 500;
            err.message = 'Error updating user';
            return next(err);
          }
          // we remove old avatars from the CDN
          cloudstorage.remove(oldAvatar);
          cloudstorage.remove(oldFullSizeAvatar);
          // We remove temporarily stored files
          fs.unlink(
            fileUtils.localImagePath(
              req,
              req.uploadedFile[0].filename));
          fs.unlink(
            fileUtils.localImagePath(
              req,
              req.uploadedFile[0].resizedFilename));

          res.writeHead(200, {
            'content-type': 'text/html'
          }); //http response header
          res.end(JSON.stringify(req.uploadedFile));
        });
      }); /* Database read callback */
    }); /* POST /upload/profilePicture/:width/:height/ */

  /**
   * GET /users/search/
   * Look for a user by displayName
   */
  app.get('/users',
    function(req, res) {
      model.User.findAll({
        attributes: ['id','avatar','ImageId', 'displayName']
      }).then(function(users) {
        console.log(users);
        res.send(users);
      });
    });

  /**
   * PUT /users/:userId
   * Update the user with id equals to userId
   */
  app.put('/users/:userId',
    function(req, res, next) {
      req.checkParams('userId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var userId = req.params.userId;
        model.User.find({
          where: {
            id: userId
          }
        }).then(function(user) {
          if (!user) {
            return res.status(400).send({
              message: 'User not found'
            });
          }
          console.log(req.body);

          user.update(req.body).
            then(function(user) {
            if (user) {
                res.send(user);
            }
          }).catch(function(err) {
            err.status = 500;
            return next(err);
          });
        });
      });
    });


  /**
   * GET /users/search/
   * Look for a user by displayName
   */
  app.get('/users/search/:searchString',
    authentication.ensureAuthenticated,
    function(req, res) {
      var searchString = req.params.searchString;
      model.User.findAll({
        where: {
          displayName: searchString
        },
      }).then(function(users) {
        console.log(users);
        res.send(users);
      });
    });

   /**
   * GET /users/search/
   * Look for a user by displayName
   */
  app.get('/users/:userId',
     function(req, res, next) {
      req.checkParams('userId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var userId = req.params.userId;
        model.User.find({
          where: {
            id: userId
          }
        }).then(function(user) {
          if (user) {
              res.send(user);
          } else {
            var err = new Error();
            err.status = 404;
            err.message = 'Requested brand does not exist';
            return next(err);
          }
        }).catch(function(err) {
          err.status = 500;
          return next(err);
        });
      });
    });

  /**
   * GET /brands/stream/:brandId
   * Return the brand's stream (list of all the posts + all the products coming from that brand)
   *  TODO: for now we just fetch all the PRODUCTS,
   * in the future we need to first see if the Brand has an associated user ID,
   * if that user ID has posted a post,
   * and then
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/users/stream/:userId',
    function(req, res, next) {
      req.checkParams('userId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var userId = req.params.userId;
        model.Post.findAll({
          where: {
            UserId: userId
          },
          include: [
            {
              model: model.Tag
            },
            {
              model: model.Brand,
            },{
              model: model.User
            },
            {
              model: model.Product,
              include: [{
                model: model.Brand
              }]
            }
          ]
        }).then(function(brand) {
          if (brand) {
              res.send(brand);
          } else {
            var err = new Error();
            err.status = 404;
            err.message = 'Requested brand does not exist';
            return next(err);
          }
        }).catch(function(err) {
          err.status = 500;
          return next(err);
        });
      });
    });


   /**
  * GET /users/following
  * returns all the users folledwed by the the requester of the end point
  * and :userId
  */
  app.get('/users/following', authentication.ensureAuthenticated, function(req, res, next) {
    var followerId = req.user;
    model.User.findById(followerId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to authenticate the user';
        err.details = databaseError;
        return next(err);
      }

      // TODO OPTIMIZE THIS, INSTEAD OF SEARCHING FIRST FOR THE EXISTENCE OF THE
      model.UserFollower.findAll({
        where: {
          FollowerId: followerId,
        }
      }).then(function(associations){
        res.send(JSON.stringify(associations));
      }).catch(function(err){
        return next(err);
      });
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to received the associations';
      err.details = databaseError;
      return next(err);
    });
  });

  /**
  * GET /users/:userId/follow
  * returns the association if exists between the requester of the end point
  * and :userId
  */
  app.get('/users/:userId/follow', authentication.ensureAuthenticated, function(req, res, next) {
    var followerId = req.user;
    var userId = req.params.userId;
    model.User.findById(followerId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows Brand in DB';
        err.details = databaseError;
        return next(err);
      }

      // TODO OPTIMIZE THIS, INSTEAD OF SEARCHING FIRST FOR THE EXISTENCE OF THE

      model.UserFollower.find({
        where: {
          UserId: userId,
          FollowerId: followerId,
        }
      }).then(function(association){
        res.send(JSON.stringify(association));
      }).catch(function(err){
        return next(err);
      });
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to create association User follows Brand in DB';
      err.details = databaseError;
      return next(err);
    });
  });


  /**
   * POST /users/:userId/follow
   * Add BrandId to the list of brands followed by the user issuing the request
   *
   * req.headers.authorization     - The user's access token in the form "Bearer: ACCESS_TOKEN"
   * req.params.brandId            - The Brand the user wants to follow
   *
   * Returns:
   * On Success               - A JSON object containing the following fields:
   *                            brandId                   - the id of the user
   *                            userId                    - the id of the brand
   *
   * On Error                 - A JSON object containing the following fields
   *                            status  - HTTP status code
   *                            message - Human readable error message
   *                            details - Error details (optional)
   */
   app.post('/users/:userId/follow', authentication.ensureAuthenticated, function(req, res, next) {
    var followerId = req.user;
    var userId = req.params.userId;
    model.User.findById(followerId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows Brand in DB';
        err.details = databaseError;
        return next(err);
      }

      // TODO OPTIMIZE THIS, INSTEAD OF SEARCHING FIRST FOR THE EXISTENCE OF THE

      model.UserFollower.findOrCreate({
        where: {
          UserId: userId,
          FollowerId: followerId,
        }
      }).then(function(association){
        res.send(JSON.stringify(association));
      }).catch(function(err){
        return next(err);
      });
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to create association User follows Brand in DB';
      err.details = databaseError;
      return next(err);
    });
  });

   /**
   * POST /brands/:brandId/unfollow
   * Add BrandId to the list of brands followed by the user issuing the request
   *
   * req.headers.authorization     - The user's access token in the form "Bearer: ACCESS_TOKEN"
   * req.params.brandId            - The Brand the user wants to follow
   *
   * Returns:
   * On Success               - A JSON object containing the following fields:
   *                            brandId                   - the id of the user
   *                            userId                    - the id of the brand
   *
   * On Error                 - A JSON object containing the following fields
   *                            status  - HTTP status code
   *                            message - Human readable error message
   *                            details - Error details (optional)
   */
   app.post('/users/:userId/unfollow', authentication.ensureAuthenticated, function(req, res, next) {
    var followerId = req.user;
    var userId = req.params.userId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows User in DB';
        err.details = databaseError;
        return next(err);
      }

      // TODO OPTIMIZE THIS, INSTEAD OF SEARCHING FIRST FOR THE EXISTENCE OF THE
      model.UserFollower.destroy({
        where: {
          UserId: userId,
          FollowerId: followerId,
        }
      }).then(function(result){
        res.send(JSON.stringify(result));
      }).catch(function(err){
        return next(err);
      });
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to remove the association User follows User in DB';
      err.details = databaseError;
      return next(err);
    });
  });


};
