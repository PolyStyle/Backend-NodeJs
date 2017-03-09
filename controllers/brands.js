'use strict';

var model = rootRequire('models/model');
var authentication = rootRequire('middleware/authentication');
var controllerUtils = rootRequire('controllers/utils');

module.exports.controller = function(app) {

  app.get('/brands/', function(req, res) {
    model.Brand.findAll().then(function(brands) {
      res.send(brands);
    });
  });


  /**
   * GET /brands/:brandId
   * Return the brand corresponding to the passed id
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/brands/:brandId',
    function(req, res, next) {
      req.checkParams('brandId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var brandId = req.params.brandId;
        model.Brand.find({
          where: {
            id: brandId
          }
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
  app.get('/brands/stream/:brandId',
    function(req, res, next) {
      req.checkParams('brandId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var brandId = req.params.brandId;
        model.Product.findAll({
          where: {
            BrandId: brandId
          },
          group: 'productCode',
          include: {
            model: model.Tag
          }
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
   * PUT /tags/:tagId
   * Update the tag with id equals to tagId
   */
  app.put('/brands/:brandId',
    function(req, res, next) {
      console.log('-------');
      console.log(req);
      console.log('-------');
      req.checkParams('brandId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var brandId = req.params.brandId;
        model.Brand.find({
          where: {
            id: brandId
          }
        }).then(function(brand) {
          if (!brand) {
            return res.status(400).send({
              message: 'Brand not found'
            });
          }
          console.log('-------');
          console.log(req.body);
          console.log('-------');
          brand.update(req.body).
            then(function(brand) {
            if (brand) {
                res.send(brand);
            } 
          }).catch(function(err) {
            err.status = 500;
            return next(err);
          });
        });
      });
    });

  /**
   * POST /brands/
   * Create new brand
   */
  app.post('/brands/',
    function(req, res) {
      var brand = req.body;

      model.Brand.create(brand).then(function(newBrand) { 
        res.send(newBrand);
      });
    }
  );

   /**
   * DELETE /brands/:brandId
   * Remove a Tag with id equals to tagId
   */
  app.delete('/brands/:brandId',
    function(req, res) {
      var brandId = req.params.brandId;
      model.Brand.findOne({
        where: {
          id: brandId
        }
      }).then(function(brand) {
        brand.destroy().then(function() {
          res.send();
        });
      });
    });

/**
  * GET /brands/:brandId/follow
  * returns the association if exists between the requester of the end point
  * and :brandId
  */
  app.get('/brands/:brandId/follow', authentication.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var brandId = req.params.brandId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to find user in the db';
        err.details = databaseError;
        return next(err);
      }

      // TODO OPTIMIZE THIS, INSTEAD OF SEARCHING FIRST FOR THE EXISTENCE OF THE

      model.BrandFollower.find({
        where: {
          UserId: userId,
          BrandId: brandId,
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
   app.post('/brands/:brandId/follow', authentication.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var brandId = req.params.brandId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows Brand in DB';
        err.details = databaseError;
        return next(err);
      }

      // TODO OPTIMIZE THIS, INSTEAD OF SEARCHING FIRST FOR THE EXISTENCE OF THE

      model.BrandFollower.findOrCreate({
        where: {
          UserId: userId,
          BrandId: brandId,
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
   app.post('/brands/:brandId/unfollow', authentication.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var brandId = req.params.brandId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows User in DB';
        err.details = databaseError;
        return next(err);
      }

      // TODO OPTIMIZE THIS, INSTEAD OF SEARCHING FIRST FOR THE EXISTENCE OF THE
      model.BrandFollower.destroy({
        where: {
          UserId: userId,
          BrandId: brandId,
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
