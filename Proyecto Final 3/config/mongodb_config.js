//Import the mongoose module
const mongooseLib = require('mongoose');

//connection
/*

mongodb+srv://ecruz:Efra2005@cluster0.veqqf.mongodb.net/test?authSource=admin&replicaSet=atlas-oy7sd2-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true

*/
// var mongoDB = 'mongodb://localhost/test';
var mongoDB = process.env.MONGODB_CONNECTION_URL;
mongooseLib.connect(mongoDB, {useNewUrlParser: true, useUnifiedTopology: true});


const db = mongooseLib.connection;

//mensage de error
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

module.exports = { db, mongooseLib };