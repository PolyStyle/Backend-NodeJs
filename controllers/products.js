'use strict';

var authentication = rootRequire('middleware/authentication');
var model = rootRequire('models/model');
var controllerUtils = rootRequire('controllers/utils');

module.exports.controller = function(app) {

  /**
   * GET /products/
   * Get all the product
   */
  app.get('/products/', function(req, res) {
    model.Product.findAll({
        include: [{
          model: model.Brand
        },{
          model: model.Tag
        }]
      }).then(function(products) {
      res.send(products);
    });
  });

  /**
   * GET /products/:productId
   * Return the product corresponding to the passed id
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/products/:productId',
    function(req, res, next) {
      req.checkParams('productId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var productId = req.params.productId;
        model.Product.find({
          where: {
            id: productId
          },
          include: [{
            model: model.Brand
          },{
            model: model.Tag
          },{
            model: model.Image
          }]
        }).then(function(product) {
          if (product) {
              res.send(product);
          } else {
            var err = new Error();
            err.status = 404;
            err.message = 'Requested product does not exist';
            return next(err);
          }
        }).catch(function(err) {
          err.status = 500;
          return next(err);
        });
      });
    });



 /**
   * GET /products/:productId
   * Return the list of all the product with the same productCode of the given product ID.
   * Important: EXCLUDES THE GIVEN PRODUCT FROM THE LIST
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/products/sameproducts/:productId',
    function(req, res, next) {
      req.checkParams('productId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var productId = req.params.productId;
        model.Product.find({
          where: {
            id: productId
          }
        }).then(function(product) {
          if (product) {
              model.Product.findAll({
                where: {
                  productCode: model.Sequelize.and({$ne: null}, {$eq: product.productCode}) ,
                  id: {$ne: product.id}
                }
              }).then(function(productsList){
                // TODO add condition if productsList is undefined
                res.send(productsList);
              })
          } else {
            var err = new Error();
            err.status = 404;
            err.message = 'Requested product does not exist';
            return next(err);
          }
        }).catch(function(err) {
          err.status = 500;
          return next(err);
        });
      });
    });


  /**
   * POST /products/
   * Create new products
   */
  app.post('/products/',
    function(req, res) {
      var product = req.body;
      model.Product.create(
        product
      ).then(function(product) {

        var tagsIds = req.body.Tags.map((tag) => {
          return tag.id;
        });
        Promise.all([
          product.setTags(tagsIds)
        ]).then(values => {
          model.Product.find({
            where: {
              id: product.id
            },
            include: [{
              model: model.Brand
            },{
              model: model.Tag
            },{
              model: model.Image
            }]
          }).then(function(inflatedProduct) {
            res.send(inflatedProduct);
          });
        });
      });
    }
  );

  /**
   * PUT /products/:productId
   * Update the product with id equals to productId
   */
  app.put('/products/:productId',
    function(req, res, next) {
      console.log('node update product');
      req.checkParams('productId', 'Invalid post id').notEmpty().isInt();
      req.getValidationResult().then(function(result) {
        if (result && !result.isEmpty()) {
          return controllerUtils.throwValidationError(result, next);
        }
        var productId = req.params.productId;
        model.Product.find({
          where: {
            id: productId
          }
        }).then(function(product) {
          if (!product) {
            return res.status(400).send({
              message: 'Brand not found'
            });
          }
          console.log('-------');
          console.log(req.body);
          console.log('-------');
          product.update(req.body).
            then(function(product) {
            if (product) {
              // here update all the joined tables,
              // sequelize has it's own setter and getters ready for the
              // model.
              var tagsIds = req.body.Tags.map((tag) => {
                return tag.id;
              });

              var brandId = req.body.Brand.id;

              Promise.all([
                product.setTags(tagsIds),
                product.setBrand(brandId)
              ]).then(values => {
                res.send(product);
              });
            }
          }).catch(function(err) {
            err.status = 500;
            return next(err);
          });
        });
      });
    });



  /**
   * POST /products/
   * Create new product
   */
  app.post('/products/',
    function(req, res) {
      var product = req.body;
      model.Product.create({
        displayName: product.displayName,
        BrandId: product.BrandId
      }).then(function(newProduct) {
        res.send(newProduct);
      });
    }
  );

/**
  * GET /posts/:postId/like
  * returns if the user requesting this endpoint liked the post with id postId
  */
  app.get('/products/:productId/like', authentication.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var productId = req.params.productId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to find user in the db';
        err.details = databaseError;
        return next(err);
      }

      model.ProductLike.find({
        where: {
          UserId: userId,
          ProductId: productId,
        }
      }).then(function(association){
        res.send(JSON.stringify(association));
      }).catch(function(err){
        return next(err);
      });
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to retrieve UserPost Likes association from DB';
      err.details = databaseError;
      return next(err);
    });
  });


  /**
   * POST /posts/:postId/like
   */

   app.post('/products/:productId/like', authentication.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var productId = req.params.productId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows Brand in DB';
        err.details = databaseError;
        return next(err);
      }

      model.ProductLike.findOrCreate({
        where: {
          UserId: userId,
          ProductId: productId,
        }
      }).then(function(association){
        res.send(JSON.stringify(association));
      }).catch(function(err){
        return next(err);
      });
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to create UserPost Likes association from DB';
      err.details = databaseError;
      return next(err);
    });
  });

   /**
   * POST /posts/:postId/unlike
   */
   app.post('/products/:productId/unlike', authentication.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var productId = req.params.productId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows User in DB';
        err.details = databaseError;
        return next(err);
      }

      model.ProductLike.destroy({
        where: {
          UserId: userId,
          ProductId: productId,
        }
      }).then(function(result){
        res.send(JSON.stringify(result));
      }).catch(function(err){
        return next(err);
      });
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to remove the association User Post from DB';
      err.details = databaseError;
      return next(err);
    });
  });

};
