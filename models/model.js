'use strict';

var Sequelize = require('sequelize');
var bcrypt = require('bcryptjs');

var config = rootRequire('config/config');

var sequelizeObject = new Sequelize(
  config.MYSQL_DATABASE,
  config.MYSQL_USER, config.MYSQL_PASSWORD, {
    host: config.MYSQL_HOST,
    logging: console.log,
    dialect: 'mysql'
  });

exports.Sequelize = Sequelize;

exports.sequelize = function() {
  return sequelizeObject;
};


/**
 * Model: User
 */
var User = sequelizeObject.define('User', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: Sequelize.STRING,
  password: Sequelize.STRING,
  firstName: Sequelize.STRING,
  lastName: Sequelize.STRING,
  gender: Sequelize.STRING,
  role: Sequelize.STRING,
  facebookToken: Sequelize.STRING
}, {
  instanceMethods: {
    comparePassword: function(password) {
      return bcrypt.compareSync(password, this.password);
    }
  }
});

User.hook('beforeValidate', function(user) {
  if (user.password) {
    var salt = bcrypt.genSaltSync(10);
    user.password = bcrypt.hashSync(user.password, salt);
    return sequelizeObject.Promise.resolve(user);
  }
});

exports.User = User;

/**
 * Model: AccessToken
 */
var AccessToken = sequelizeObject.define('AccessToken', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  browser: Sequelize.STRING,
  version: Sequelize.STRING,
  os: Sequelize.STRING,
  platform: Sequelize.STRING,
  refreshToken: Sequelize.STRING
});

exports.AccessToken = AccessToken;

AccessToken.hook('beforeValidate', function(token) {
  var salt = bcrypt.genSaltSync(10);
  token.refreshToken = bcrypt.hashSync(token.refreshToken, salt);
  return sequelizeObject.Promise.resolve(token);
});

/*
* POST: Model
* A post contain an image (usually a picture with many item inside)
*/

var Post = sequelizeObject.define('Post', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  picture: Sequelize.STRING,
  description: Sequelize.STRING,
});
exports.Post = Post;

/* Model Brand */

var Brand = sequelizeObject.define('Brand', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  displayName: Sequelize.STRING,
});
exports.Brand = Brand;

/* Model Brand */

var Product = sequelizeObject.define('Product', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  sourceURL: Sequelize.STRING,
  itemCode: Sequelize.STRING,
  productCode: Sequelize.STRING,
  displayName: Sequelize.STRING,
  sourceURL: Sequelize.STRING,
});
exports.Product = Product;


/* Model Tags  */

var Tag = sequelizeObject.define('Tag', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  displayName: Sequelize.STRING,
});
exports.Tag = Tag;

// Relationships part

User.hasMany(Post, {
  foreignKey: {
    name: 'UserId',
    allowNull: false
  },
  onDelete: 'CASCADE'
});

User.hasMany(AccessToken, {
  foreignKey: {
    name: 'UserId',
    allowNull: false
  },
  onDelete: 'CASCADE'
});

Post.belongsToMany(Tag, {
  through: 'PostTag',
});

Post.belongsToMany(Brand, {
  through: 'PostBrand',
});

Product.belongsToMany(Tag, {
  through: 'ProductTag',
});

Product.belongsTo(Brand)
Post.belongsTo(User)
AccessToken.belongsTo(User)

/**
 * Model: Converted Price
 */
var PostProduct = sequelizeObject.define('PostProduct', {
  category: Sequelize.STRING,
});

Post.belongsToMany(Product,{
  through: PostProduct
})

/**
 * Model: Image
 */
var Image = sequelizeObject.define('Image', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  }
});

exports.Image = Image;

var ScaledImage = sequelizeObject.define('ScaledImage', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  width: Sequelize.INTEGER,
  height: Sequelize.INTEGER,
  url: Sequelize.STRING
});

exports.ScaledImage = ScaledImage;

// Relationships part

Image.hasMany(ScaledImage, {
  foreignKey: {
    name: 'ImageId',
    allowNull: false
  },
  onDelete: 'CASCADE'
});

ScaledImage.belongsTo(Image);

// Relationships part

User.hasMany(Post, {
  foreignKey: {
    name: 'UserId',
    allowNull: false
  },
  onDelete: 'CASCADE'
});

Post.belongsToMany(Tag, {
  through: 'PostTag',
});

Post.belongsToMany(Brand, {
  through: 'PostBrand',
});

Product.belongsToMany(Tag, {
  through: 'ProductTag',
});

Product.belongsTo(Brand);
Product.belongsTo(Image);
Post.belongsTo(User);
Post.belongsTo(Image);
User.belongsTo(Image);

Brand.belongsTo(Image, {
    foreignKey: 'BackgroundImageId',
    as: 'BackgroundImage',
});

Brand.belongsTo(Image, {
    foreignKey: 'AvatarImageId',
    as: 'AvatarImage',
});


/**
 * Model: Converted Price
 */
var PostProduct = sequelizeObject.define('PostProduct', {
  category: Sequelize.STRING,
});

Post.belongsToMany(Product,{
  through: PostProduct
})



/**
 * Create database and default entities if do not exist
 **/
sequelizeObject.sync().then();

