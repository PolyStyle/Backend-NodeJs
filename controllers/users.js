'use strict';

var fs = require('fs-extra');
var geoip = require('geoip-lite');

var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');

module.exports.controller = function(app) {

  /**
   * GET /me
   * Get authenticated user profile information
   */
  app.get('/me', authenticationUtils.ensureAuthenticated, function(req, res) {

    model.User.find({
      where: {
        id: req.user
      }
    }).then(function(user) {
      res.send(user);
    });
  });

  /**
   * GET /me
   * Get authenticated user profile information
   */
  app.get('/me/cart',
    authenticationUtils.ensureAuthenticated,
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
    authenticationUtils.ensureAuthenticated,
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
    authenticationUtils.ensureAuthenticated,
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
    authenticationUtils.ensureAuthenticated,
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
    authenticationUtils.ensureAuthenticated,
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
    authenticationUtils.ensureAuthenticated,
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
    authenticationUtils.ensureAuthenticated,
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
    authenticationUtils.ensureAuthenticated,
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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
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


  /**
   * GET /users/search/
   * Look for a user by displayName
   */
  app.get('/users/search/:searchString',
    authenticationUtils.ensureAuthenticated,
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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
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


}; /* End of users controller */
