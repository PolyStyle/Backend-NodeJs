'use strict';

var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');

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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
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
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
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

  /**
   * POST /brands/
   * Create new brand
   */
  app.post('/brands/',
    function(req, res) {
      var brand = req.body;

      model.Brand.create({
        displayName: brand.displayName,
        picture: brand.picture,
        headerBackground: brand.headerBackground
      }).then(function(newBrand) { 
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

}; /* End of genres controller */


/* 

{
  picture: 'https://s-media-cache-ak0.pinimg.com/474x/1a/eb/2e/1aeb2eff3242f5884a8a23e4bdb7946f.jpg',
  description: 'Marcos favorite outfit',
  tags: [1,2],
  UserId: 1
}




*/