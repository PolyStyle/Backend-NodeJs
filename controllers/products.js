'use strict';

var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');

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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var productId = req.params.productId;
      model.Product.find({
        where: {
          id: productId
        }, 
        include: model.Brand
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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
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
        res.send(product);
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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
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

            Promise.all([product.setTags(tagsIds)]).then(values => { 
              res.send(product);
            });
          } 
        }).catch(function(err) {
          err.status = 500;
          return next(err);
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
        picture: product.picture,
        displayName: product.displayName,
        BrandId: product.BrandId
      }).then(function(newProduct) { 
        res.send(newProduct);
      });
    }
  );


}; /* End of genres controller */


/* 

{
  displayName: 'Nike Shoes',
  picture:  'https://s-media-cache-ak0.pinimg.com/474x/51/80/00/5180009b176132bba9729c0f910b4bd7.jpg',
  BrandId: 1
}




*/