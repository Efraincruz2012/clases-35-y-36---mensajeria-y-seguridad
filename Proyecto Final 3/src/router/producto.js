const { Router } = require('express');
const ControladorProducto = require('../Daos/ControladorDaoProducto');

const routerProducto = Router();

const productController = new ControladorProducto();

routerProducto.get('/', async (req, res) => {
    req.loggerBase(req);
    const productos = await productController.listarAll();
    res.send(productos);
})

routerProducto.get('/:id', async (req, res) => {
    req.loggerBase(req);
    const producto = await productController.listar(req.params.id);
    res.send(producto);

});

routerProducto.post('/',async (req, res) => {
    req.loggerBase(req);
    // Si en el query viene edit entonces se actualiza el producto
    // esto es por que los formularios no dejan usar el method put
    // entonces hay que decirle al backend de otra forma que es un update
    // en este caso usando el queryString edit (mirar la ruta el formulario en html)
    if (req.query.edit) {
        try{
            const newProductData = {
                id:  req.body.id,
                name: req.body.name,
                thumbnail: req.body.thumbnail,
                price: parseFloat(req.body.price)
            };

            const response = await productController.updateProduct(newProductData);
            res.send(`Producto actualizado: ${newProductData}`);
        }catch(e){
            res.send(`Error: ${e}`);
        }
    } else {

        await productController.createProduct(req.body);
        
        return res.status(204).json();
    }
    
})

routerProducto.delete('/:id', async (req, res) => {
    req.loggerBase(req);
    const PROD = await Pro.listarAll()
    const { id } = req.params
   
    const newPro = PROD.find(e => e.id == id);
    Pro.borrar(id);
    res.send({ borrada: newPro })
})

routerProducto.use(function(req, res) {
    // Invalid request
    const { originalUrl, method } = req
    req.loggerWarning(`Ruta ${method} ${originalUrl} no implementada`);
});


exports.routerProducto = routerProducto; 