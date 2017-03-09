'use strict';

var model = rootRequire('models/model');
var imageModel = rootRequire('models/images');
var cdn = rootRequire('libs/cdn/cloudstorage');
var controllerUtils = rootRequire('controllers/utils');

var path = require('path');
var sharp = require('sharp');
var multer  = require('multer');
var fs = require('fs');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp');
  },
  filename: function (req, file, cb) {
    var parsedName = path.parse(file.originalname);
    cb(null, imageModel.getTemporaryName(parsedName.name, parsedName.ext));
  }
});
// Check encoding, only jpeg and png files are allowed
var fileFilter = function (req, file, cb) {

  var filetypes = /jpeg|jpg|png/;
  var mimetype = filetypes.test(file.mimetype);
  var extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  var err = new Error();
  err.status = 400;
  err.message = 'File upload only supports the following filetypes:' + filetypes;
  return cb(err);
};

var upload = multer({ storage: storage, fileFilter: fileFilter }).single('file');

module.exports.controller = function(app) {

  function validate(req, res) {
    if (!req.body.sizes) {
        var err = new Error();
        err.status = 400;
        err.message = 'Missing \'sizes\' parameter';
        return err;
    }
    var sizes;
    try {
      sizes = JSON.parse(req.body.sizes);
    } catch (parseError) {
        var err = new Error();
        err.status = 400;
        err.message = '\'sizes\' parameter is not valid JSON';
        return err;
    }
    if (!Array.isArray(sizes) || sizes.length > 5) {
        var err = new Error();
        err.status = 400;
        err.message = '\'sizes\' must be an array of at most 5 elements';
        return err;
    }
    if (!req.file) {
        var err = new Error();
        err.status = 400;
        err.message = 'Missing \'file\' parameter';
        return err;
    }
    return;
  }

  function createScaledImage(imageId, localPath, width, height) {
    var extension = path.extname(localPath);
    var promise = new Promise(function(fullfill, reject) {
      cdn.upload(imageModel.getCDNPath(imageId, extension, width, height), localPath, function(uploadError, filename) {
        if (uploadError) {
          var err = new Error();
          err.status = 500;
          err.message = 'Failed to upload image';
          err.details = uploadError;
          reject(err);
        } else {
          model.ScaledImage.create({
            ImageId: imageId,
            width: width,
            height: height,
            url: imageModel.getCDNUrl(imageId, extension, width, height)
          }).then(function(scaledImage) {
            fullfill(scaledImage.url);
          }).catch(function(databaseError) {
            var err = new Error();
            err.status = 500;
            err.message = 'Failed to create scaled image in DB';
            err.details = databaseError;
            reject(err);
          });
        }
      });
    });
    return promise;
  }

  /**
   * Uploads an image to the CDN. The image is also scaled to the provided sizes
   *
   * req.body.file      - The uploaded image
   * req.body.sizes     - The sizes the provided image should be scaled to. An array as
   *                      [{width=300, height=300}]
   *
   * Returns:
   * On Success         - A JSON object containing the following fields:
   *                      id      - signed URL to the requested image, valid for 60s
   *                      sizes   - the sizes to which the image was successfully scaled. An array
   *                                as [{width=300, height=300}]
   * On Error           - A JSON object containing the following fields
   *                      status  - HTTP status code
   *                      message - Human readable error message
   *                      details - Error details (optional)
   *
   * Test with CURL:
   * curl -F "file=@<path-to-file>" -F "sizes=[{\"width\":<width>, \"height\":<height>}]" localhost:3000/images/upload
   */
  app.post('/images/upload/', function(req, res, next) {
    return upload(req, res, function (err) {
      err = err ? err : validate(req, res, next);
      if (err) {
        // An error occurred when uploading
        return next(err);
      }
      var extension = path.extname(req.file.path);
      var uploadPath = req.file.path;
      console.log(req.body);
      var sizes = JSON.parse(req.body.sizes);
      var sizesProcessed = 0;
      var uploadedSizes = [];
      var uploadTasks = [];
      model.Image.create({}).then(function(image) {
        var originalImage = sharp(req.file.path);
        originalImage.metadata().then(function(metadata) {
          // upload original image
          cdn.upload(imageModel.getCDNPath(image.id, extension, metadata.width, metadata.height), uploadPath, function(uploadError, filename) {
            if (uploadError) {
              image.destroy();
              var err = new Error();
              err.status = 500;
              err.message = 'Failed to upload image';
              err.details = uploadError;
              return next(err);
            } else {
              model.ScaledImage.create({
                ImageId: image.id,
                width: metadata.width,
                height: metadata.height,
                url: imageModel.getCDNUrl(image.id, extension, metadata.width, metadata.height)
              }).then(function(scaledImage) {
                uploadedSizes.push({
                  width: scaledImage.width,
                  height: scaledImage.height
                });
                sizes.forEach(function(size) {
                  uploadTasks.push(new Promise(function(fullfill, reject) {
                    var width = size.width;
                    var height = size.height;
                    var resizedPath = imageModel.getTemporaryPath(image.id, extension, width, height);
                    sharp(req.file.path).resize(width, height).toFile(resizedPath,
                      function(err, info) {
                        if (!err) {
                          createScaledImage(image.id, resizedPath, width, height).then(function(scaledUrl) {
                            fs.unlink(resizedPath);
                            uploadedSizes.push({
                              width: width,
                              height: height
                            });
                            fullfill();
                          }).catch(function(createdScaledError) {
                            fs.unlink(resizedPath);
                            fullfill();
                          });
                        } else {
                          fs.unlink(resizedPath);
                          fullfill();
                        }
                      });
                    }));
                  });
                  Promise.all(uploadTasks).then(function(result) {
                    res.send(JSON.stringify({
                      id: image.id,
                      sizes: uploadedSizes
                    }));
                  }).catch(function(scaleError) {
                    image.destroy();
                    fs.unlink(uploadPath);
                    var err = new Error();
                    err.status = 500;
                    err.message = 'Failed to create scaled images';
                    err.details = scaleError;
                    return next(err);
                  });
                }).catch(function(databaseError) {
                  image.destroy();
                  fs.unlink(uploadPath);
                  var err = new Error();
                  err.status = 500;
                  err.message = 'Failed to create scaled image in DB';
                  err.details = databaseError;
                  return next(err);
                });
              }
            });
          }).catch(function(metadataError) {
              image.destroy();
              fs.unlink(uploadPath);
              var err = new Error();
              err.status = 500;
              err.message = 'Failed to upload image';
              err.details = metadataError;
              return next(err);
          });
        }).catch(function(databaseError) {
          fs.unlink(uploadPath);
          var err = new Error();
          err.status = 500;
          err.message = 'Failed to create scaled image in DB';
          err.details = databaseError;
          return next(err);
        });
      });
    });

  /**
   * Returns the requested image provided its id an minimum width.
   * 
   * req.params.id      - The id of the image to return
   * req.params.width   - The width we are interested in. The returned image will at least be width
   *
   * Returns:
   * On Success         - A JSON object containing the following fields:
   *                      url     - signed URL to the requested image, valid for 60s
   *                      width   - the width of the returned image
   *                      height  - the height of the returned image
   * On Error           - A JSON object containing the following fields
   *                      status  - HTTP status code
   *                      message - Human readable error message
   *                      details - Error details (optional)
   *
   * Test with CURL:
   * curl localhost:3000/images/5/200             
   */
  app.get('/images/:id/:width', function(req, res, next) {
    req.checkParams('id', 'Invalid image id').notEmpty().isInt();
    req.checkParams('width', 'Invalid image width').notEmpty().isInt();
    req.getValidationResult().then(function(result) {
      if (result && !result.isEmpty()) {
        return controllerUtils.throwValidationError(result, next);
      }
      var id = req.params.id;
      var width = req.params.width;
      model.ScaledImage.findAll({
        where: {
          ImageId: id,
        },
        order: ['width']
      }).then(function(images) {
        if (!images || images.length == 0) {
          var err = new Error();
          err.status = 404;
          err.message = 'Image not found';
          return next(err);
        }
        // Falback in case there are no images bigger
        let imageToUse = images[images.length-1];
        for(var i = images.length-1; i >= 0 && images[i].width >= width; i--){
          console.log(images[i].width,width);
          imageToUse = images[i];
        }

        cdn.createSignedUrl(imageToUse.url, 'GET', 60, function(signUrlError, signedUrl) {
          if (signUrlError) {
            var err = new Error();
            err.status = 500;
            err.message = 'Error signing URL';
            err.details = signUrlError
            return next(err);
          }
          return res.send({
            url: signedUrl,
            width: imageToUse.width,
            height: imageToUse.height
          });
        });
      }).catch(function(databaseError) {
        var err = new Error();
        err.status = 500;
        err.message = 'Error fetching image';
        err.details = databaseError;
        return next(err);
      });
    });
  });

};
