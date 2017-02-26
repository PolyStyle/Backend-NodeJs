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

  app.get('/posts/', function(req, res) {
    model.Post.findAll({
      order: [
      // Will escape username and validate DESC against a list of valid direction parameters
        ['createdAt', 'DESC'],
      ],
    }).then(function(posts) {
      res.send(posts);
    });
  });


  /**
   * GET /post/:postId
   * Return the product corresponding to the passed id
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/posts/:postId',
    function(req, res, next) {
      req.checkParams('postId', 'Invalid post id').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var postId = req.params.postId;
      model.Post.find({
        where: {
          id: postId
        },
        include: inflatedObject
      }).then(function(post) {
        if (post) {
            res.send(post);
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested post does not exist';
          return next(err);
        }
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });


  /**
   * POST /posts/
   * Create new posts
   */
  app.post('/posts/',
    function(req, res) {
      var post = req.body;
      model.Post.create({
        description: post.description,
        UserId: 1,
        ImageId: post.ImageId,
      }).then(function(newBrand) {
        var tagsIds = req.body.Tags.map((tag) => {
          return tag.id;
        });
        var brandsIds = req.body.Brands.map((brand) => {
          return brand.id;
        });
        var productsIds = req.body.Products.map((product) => {
          return product.id;
        });

        Promise.all([
          newBrand.setTags(tagsIds),
          newBrand.setBrands(brandsIds),
          newBrand.setProducts(productsIds)
        ]).then(values => {
          res.send(newBrand);
        });
      });
    }
  );


  /**
   * PUT /posts/:postId
   * Update the post with id equals to postId
   */
  app.put('/posts/:postId',
    function(req, res, next) {
      console.log('node update post');
      req.checkParams('postId', 'Invalid post id').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var postId = req.params.postId;
      model.Post.find({
        where: {
          id: postId
        }
      }).then(function(post) {
        if (!post) {
          return res.status(400).send({
            message: 'Brand not found'
          });
        }
        console.log('-------');
        console.log(req.body);
        console.log('-------');
        post.update(req.body).
          then(function(post) {
          if (post) {
            // here update all the joined tables,
            // sequelize has it's own setter and getters ready for the
            // model.
            var tagsIds = req.body.Tags.map((tag) => {
              return tag.id;
            });
            var brandsIds = req.body.Brands.map((brand) => {
              return brand.id;
            });
            var productsIds = req.body.Products.map((product) => {
              return product.id;
            });

            Promise.all([
              post.setTags(tagsIds),
              post.setBrands(brandsIds),
              post.setProducts(productsIds)
            ]).then(values => {
              res.send(post);
            });
          }
        }).catch(function(err) {
          err.status = 500;
          return next(err);
        });
      });
    });



/**
  * GET /posts/:postId/like
  * returns if the user requesting this endpoint liked the post with id postId
  */
  app.get('/posts/:postId/like', authenticationUtils.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var postId = req.params.postId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to find user in the db';
        err.details = databaseError;
        return next(err);
      }

      model.PostLike.find({
        where: {
          UserId: userId,
          PostId: postId,
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

   app.post('/posts/:postId/like', authenticationUtils.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var postId = req.params.postId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows Brand in DB';
        err.details = databaseError;
        return next(err);
      }

      model.PostLike.findOrCreate({
        where: {
          UserId: userId,
          PostId: postId,
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
   app.post('/posts/:postId/unlike', authenticationUtils.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var postId = req.params.postId;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows User in DB';
        err.details = databaseError;
        return next(err);
      }

      model.PostLike.destroy({
        where: {
          UserId: userId,
          PostId: postId,
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








}; /* End of genres controller */

