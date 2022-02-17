let mongoose;
let Schema;
let ProductSchema;
let ProductModel;

const { mongooseLib } = require('../../config/mongodb_config.js');
mongoose = mongooseLib;
Schema = mongoose.Schema;

ProductSchema = new Schema({
    name: {type: String, required: true},
    thumbnail: String,
    price: String
}, {collection: 'producto'});

ProductModel = mongoose.model('ProductModel', ProductSchema);

class Product {

  constructor() {
    this.db = process.env.DB;
  }

  async find(id) {

    return await ProductModel.findById(id);

  }

  async findAll() {

    return await ProductModel.find()
        .then((docs) => {
          return docs;
        });

  }

  async create(data) {

    const doc = new ProductModel({
        name: data.name,
        price: data.price,
        thumbnail: data.thumbnail
    });
    await doc.save();
    return doc;

  }

  async update(data) {

    let updated = {};
    await ProductModel.findByIdAndUpdate(data.id, data).then(doc => updated = doc);
    return updated;

  }

};

module.exports = { ProductSchema, Product };
