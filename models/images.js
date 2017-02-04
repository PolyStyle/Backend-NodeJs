'use strict';

var model = rootRequire('models/model');
var config = rootRequire('config/config');
var cdn = rootRequire('libs/cdn/cloudstorage');
var request = require('request');

/**
 * Returns the path to the image in the CDN.
 */
function getCDNPath(imageId, extension, width, height) {

  return config.CDN_IMAGE_PATH + '/' + imageId + '_' + width + '_' + height + extension;
}

exports.getCDNPath = getCDNPath;

/**
 * Returns the name to give to an image to temporary store in on the file system.
 */
function getTemporaryName(originalName, extension) {
  return originalName + '_' + Date.now() + extension;
}

exports.getTemporaryName = getTemporaryName;

/**
 * Returns the path for temporary storing an image.
 */
function getTemporaryPath(imageId, extension, width, height) {
  return '/tmp/' + imageId + '_' + width + '_' + height + extension;
}

exports.getTemporaryPath = getTemporaryPath;

/**
 * Returns the URL to the image in the CDN.
 */
function getCDNUrl(imageId, extension, width, height) {
  return 'gs://' + config.BUCKET_NAME + '/' + getCDNPath(imageId, extension, width, height);
}

exports.getCDNUrl = getCDNUrl;

/**
 * Create an image given an external URL.
 */
function createImageFromUrl(imageUrl, extension, width, height) {
  return new Promise(function(fullfill, reject) {
    model.Image.create({}).then(function(image) {
      var writeStream = cdn.writeStream(getCDNPath(image.id, extension, width, height));
      writeStream.on('error', (streamError) => {
        reject(streamError);
      });
      writeStream.on('finish', () => {
        model.ScaledImage.create({
          ImageId: image.id,
          width: width,
          height: height,
          url: getCDNUrl(image.id, extension, width, height)
        }).then(function(scaledImage) {
          fullfill(image);
        }).catch(function(databaseError) {
          reject(databaseError);
        });
      });
      request(imageUrl).pipe(writeStream);
    });
  });
}

exports.createImageFromUrl = createImageFromUrl;