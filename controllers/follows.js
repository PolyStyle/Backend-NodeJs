'use strict';

var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');


module.exports.controller = function(app) {

  /* BRAND FOLLOWS PART */

  /* ADDING FOLLOWS */

  /**
   * POST /followBrand/:brandId
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
   app.post('/followBrand/:brandId', authenticationUtils.ensureAuthenticated, function(req, res, next) {
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
      console.log(model.BrandFollower)
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




}; /* End of tags controller */


/*

{
  picture: 'https://s-media-cache-ak0.pinimg.com/474x/1a/eb/2e/1aeb2eff3242f5884a8a23e4bdb7946f.jpg',
  description: 'Marcos favorite outfit',
  tags: [1,2],
  UserId: 1
}




*/
