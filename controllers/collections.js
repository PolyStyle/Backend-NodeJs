'use strict';

var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');



module.exports.controller = function(app) {
  /* The endpoint in this file
  /
  /   GET /users/:userId/collections
  /   GET /collections/:collectionId
  /  POST /collections/
  /   PUT /collections/:collectionId.  NOT IMPLEMENTED
  /  POST /collections/:collectionId/addPost/
  /  POST /collections/:collectionId/removePost/
  /  POST /collections/:collectionId/addProduct/
  /  POST /collections/:collectionId/removeProduct/
  */

var includeLastFiveItems = [
      {
        model: model.Product,

        attributes: ['id','ImageId'],
      },
      {
        model: model.Post,

        attributes: ['id','ImageId'],
      }
  ];

  /* Get all the collection of the user userID */
  app.get('/users/:userId/collections', function(req, res) {
    req.checkParams('userId', 'Invalid user id').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
    var userId = req.params.userId;
    model.Collection.findAll({
      include: includeLastFiveItems,
      where: {
       UserId: userId,
      }
    }).then(function(collections) {
      res.send(collections );
    });
  });

  /* Get the collection with collectionId  */
  app.get('/collections/:collectionId', function(req, res) {
    req.checkParams('collectionId', 'Invalid user id').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
    var id = req.params.collectionId;
    model.Collection.findAll({
      where: {
       id: id,
      }
    }).then(function(collection) {
      res.send(collection);
    });
  });



   /**
   * POST /collections/
   * Create new collection
   */
  app.post('/collections/', authenticationUtils.ensureAuthenticated, function(req, res, next) {
   var userId = req.user;
      var collection = req.body;
      console.log(req.body);
      console.log(collection);
      model.Collection.create({
      displayName: collection.displayName,
      UserId: userId,
    }).then(function(newCollection) {
        res.send(newCollection);
    });
  });



  /**
   * POST /collections/:collectionsId/addPost/
   */

   app.post('/collections/:collectionId/addPost', authenticationUtils.ensureAuthenticated, function(req, res, next) {

    var userId = req.user;
    var collectionId = req.params.collectionId;
    var post = req.body;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows Brand in DB';
        err.details = databaseError;
        return next(err);
      }
      model.Collection.find({
        where:{
          UserId: userId,
          id: collectionId,
        }
      }).then(function(collection){
        model.CollectionPost.findOrCreate({
          where: {
            CollectionId: collection.id,
            PostId: post.id,
          }
        }).then(function(association){
          res.send(JSON.stringify(association));
        }).catch(function(err){
          return next(err);
        });
      })
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to create UserPost Likes association from DB';
      err.details = databaseError;
      return next(err);
    });
  });

   /**
   * POST /collections/:collectionId/addPost
   */
   app.post('/collections/:collectionId/removePost', authenticationUtils.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var collectionId = req.params.collectionId;
    var post = req.body.post;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows User in DB';
        err.details = databaseError;
        return next(err);
      }

      model.CollectionPost.destroy({
        where:{
          CollectionId: collection.id,
          PostId: post.id,
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


  /**
   * POST /collections/:collectionsId/addPost/
   */

   app.post('/collections/:collectionId/addProduct', authenticationUtils.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var collectionId = req.params.collectionId;
    var product = req.body.product;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows Brand in DB';
        err.details = databaseError;
        return next(err);
      }
      model.Collection.find({
        where:{
          UserId: userId,
          id: collectionId,
        }
      }).then(function(collection){
        model.CollectionProduct.findOrCreate({
          where: {
            CollectionId: collection.id,
            ProductId: product.id,
          }
        }).then(function(association){
          res.send(JSON.stringify(association));
        }).catch(function(err){
          return next(err);
        });
      })
    }).catch(function(databaseError) {
      var err = new Error();
      err.status = 500;
      err.message = 'Failed to create UserPost Likes association from DB';
      err.details = databaseError;
      return next(err);
    });
  });

   /**
   * POST /collections/:collectionId/addPost
   */
   app.post('/collections/:collectionId/removeProduct', authenticationUtils.ensureAuthenticated, function(req, res, next) {
    var userId = req.user;
    var collectionId = req.params.collectionId;
    var product = req.body.product;
    model.User.findById(userId).then(function(user) {
      if (!user) {
        var err = new Error();
        err.status = 404;
        err.message = 'Failed to create association User follows User in DB';
        err.details = databaseError;
        return next(err);
      }

      model.CollectionProduct.destroy({
        where:{
          CollectionId: collection.id,
          ProductId: product.id,
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







}; /* End of collections controller */

