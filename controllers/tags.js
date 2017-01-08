'use strict';

var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');

var inflatedObject = [
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
  ];

module.exports.controller = function(app) {

  app.get('/tags/', function(req, res) {
    model.Tag.findAll().then(function(tags) {
      res.send(tags);
    });
  });


  /**
   * GET /tags/:tagId
   * Return the tag corresponding to the passed id
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/tags/:tagId',
    function(req, res, next) {
      req.checkParams('tagId', 'Invalid post id').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var tagId = req.params.tagId;
      model.Tag.find({
        where: {
          id: tagId
        }
      }).then(function(tag) {
        if (tag) {
            res.send(tag);
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested tag does not exist';
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
  app.get('/tags/stream/:tagId',
    function(req, res, next) {
      req.checkParams('tagId', 'Invalid post id').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var tagId = req.params.tagId;
      model.Post.findAll({
        include: [
          {
            model: model.Tag,
            where: {
              id: tagId
            }, 
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
      }).then(function(tagStream) {
        if (tagStream) {
            res.send(tagStream);
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested tag does not exist';
          return next(err);
        }
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });


  /**
   * POST /genres/
   * Create new genre
   */
  app.post('/tags/',
    function(req, res) {
      var tag = req.body;

      model.Tag.create({
        displayName: tag.displayName,
      }).then(function(tag) { 
        res.send(tag);
      });
    }
  );
}; /* End of genres controller */


/* 

{
  picture: 'https://s-media-cache-ak0.pinimg.com/474x/1a/eb/2e/1aeb2eff3242f5884a8a23e4bdb7946f.jpg',
  description: 'Marcos favorite outfit',
  tags: [1,2],
  UserId: 1
}




*/