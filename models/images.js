'use strict';

var config = rootRequire('config/config');

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