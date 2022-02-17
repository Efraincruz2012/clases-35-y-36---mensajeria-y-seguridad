const Carrito = require('../models/carritoModel.js');

class ControladorCarrito {

    constructor(ruta) {
        this.ruta = ruta
    }


    async listarAll() {

        const carritoModel = new Carrito();
        return await carritoModel.findAll();

    }

    async getCarritoById(id) {

        const carritoModel = new Carrito();
        return await carritoModel.find(id);
    }

    async create() {

      const carritoModel = new Carrito();
      return await carritoModel.create();

    }

    async addProductToCar(productId, carritoId) {

        const carritoModel = new Carrito();
        return await carritoModel.addProduct({productId, carritoId});

    }

    async removeAllProductsFromCar(carritoId) {

        const carritoModel = new Carrito();
        return await carritoModel.removeAllProducts({carritoId});

    }

}

module.exports = ControladorCarrito