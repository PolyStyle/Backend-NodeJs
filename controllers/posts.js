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
      include: inflatedObject
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
   * POST /genres/
   * Create new genre
   */
  app.post('/posts/',
    function(req, res) {
      var post = req.body;

      model.Post.create({
        picture: post.picture,
        description: post.description,
        UserId: post.UserId
      }).then(function(newPost) { 
        console.log(post.tags)
        newPost.setTags(post.tags || []).then(function(){
          newPost.setBrands(post.brands || []).then(function(){
            newPost.setProducts(post.products || []).then(function(){
              res.send(newPost);
            })
          })
        })
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