const { mongooseLib } = require('../../config/mongodb_config.js');
mongoose = mongooseLib;

const Schema = mongoose.Schema;

const userSchema = new Schema({
    nombre: String,
    password: String,
    email: String,
    age: String,
    address: String,
    phone: String,
    picture: String,
    carritoid: String
}, {collection: 'user'});

const UserModel = mongoose.model('UserModel', userSchema);

module.exports = UserModel;
