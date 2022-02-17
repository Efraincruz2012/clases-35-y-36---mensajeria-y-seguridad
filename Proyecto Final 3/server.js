const express = require('express')
const compression = require('compression')
const winston = require('winston');
const path = require('path')
const cluster = require('cluster')
const cookieParser = require('cookie-parser');
const jwt = require("jsonwebtoken");
const bcrypt = require ('bcrypt');
const multer = require('multer');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

require('dotenv').config()

const appDir = path.dirname(require.main.filename);

const yargs = require('yargs/yargs')(process.argv.slice(2))

const argumentosEntrada = yargs
.boolean('debug')
.alias({
  p: 'puerto',
  f: 'FORK',
  c: 'CLUSTER'
})
.default({
  puerto: 8080,
  FORK: 'on',
  CLUSTER: 'off', 
}).argv;

const { routerProducto } = require("./src/router/producto")
 
const { routerCarrito } = require("./src/router/carrito")

const { routerRandoms } = require("./src/router/randoms")

 
const app = express()

app.use(express.json())

app.use(express.urlencoded({ extended: true }))

app.use(cookieParser());

// Twilio para whatsapp

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Configuración multer

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './imagenes')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })

// Envio de emails

function createSendMail(mailConfig) {

  const transporter = nodemailer.createTransport(mailConfig);

  return function sendMail({ to, subject, text, html }) {
    const mailOptions = { from: mailConfig.auth.user, to, subject, text, html };
    return transporter.sendMail(mailOptions)
  }
}

function createSendMailEthereal() {
  return createSendMail({
    service: process.env.MAIL_SERVICE,
    port: process.env.MAIL_PORT,
    auth: {
      user: process.env.AUTH_GMAIL_EMAIL,
      pass: process.env.AUTH_GMAIL_PASSWORD,
    },
  })
}

const sendMail = createSendMailEthereal();

const mailTo = async ({to, subject, message}) => {
  const info = await sendMail({
    to,
    subject,
    html: message
  })

  console.log(info)
}

app.use(express.static('public'))
app.use('/imagenes', express.static('imagenes'));

app.set('views', path.join(__dirname, './src/views'))
app.set('view engine', 'ejs');

const ControladorProducto = require('./src/Daos/ControladorDaoProducto');
const ControladorCarrito = require('./src/Daos/ControladorDaoCarrito');

const carritoController = new ControladorCarrito();

const UserModel = require('./src/models/UserModel.js');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'warn.log', level: 'warning' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ level: 'info' }),
    new winston.transports.Console({ level: 'warn' }),
    new winston.transports.Console({ level: 'error' }),
  ],
});

const loggerBase = req => {
  const { originalUrl, method } = req;
  logger.info(`Route: ${originalUrl} Method: ${method}`);
}

const loggerError = error => {
  logger.error(`Error: ${error}`);
}

const loggerWarning = warning => {
  logger.warn(`${warning}`);
}

function generateToken(user) {
  const token = jwt.sign({ data: user }, process.env.PRIVATE_KEY, { expiresIn: '24h' });
  return token;
}

const auth = (req, res, next) => {
  const token = req.cookies['user'];

  jwt.verify(token, process.env.PRIVATE_KEY, (err, decoded) => {
    if (err) {
      return res.render('login' );
      // return res.status(403).json({
      //   error: 'not authorized'
      // });
    }

    req.user = decoded.data;
    next();
  });

};




app.get('/', auth, async (req, res) => {
  loggerBase(req)

  try {
    if (req.user)
      res.render('index', { nombre: req.user.nombre, picture: req.user.picture  } );
    else
      res.render('login' );

  } catch (error) {
    loggerError(error);
  }
});

// LOGIN

app.get('/login', (req, res) => {
  loggerBase(req)
  res.render('login');

});

app.post('/login', async (req, res) => {
  loggerBase(req)
  const { nombre, password } = req.body;

  const usuarios = await UserModel.find()
    .then((docs) => {
      return docs;
    });
  
  const usuario = usuarios.find(usuario => usuario.nombre === nombre);

  if (!usuario) {
    return res.render('login', { error: 'credenciales invalidas' });
  }
  
  let samePassword = await new Promise((resolve, reject) => {

    bcrypt.compare(password, usuario.password, function(err, result) {
      if (err) reject(err)
      resolve(result)
    });
  
  });

  if (!samePassword) {
    return res.render('login', { error: 'credenciales invalidas' });
  }

  const access_token = generateToken(usuario)

  res.render('index', {token: access_token, nombre: usuario.nombre, picture: usuario.picture })
})

app.get('/logout', (req, res) => {
  loggerBase(req)
  res.render('login', { action: 'logout' });
})

// REGISTER
app.post('/registro', upload.single('profile-picture'), async (req, res) => {
  loggerBase(req)
  const { nombre, password, email, age, address, countrycode, phone } = req.body

  const usuarios = await UserModel.find()
          .then((docs) => {
            return docs;
          });
  
  const usuario = usuarios.find(usuario => usuario.nombre == nombre)
  if (usuario) {
    return res.json({ error: 'ya existe ese usuario' });
  }

  const saltRounds = 10;
  let passwordCodificado = '';
  
  const fullphone = `+${countrycode}${phone}`;

  let nuevoUsuario;

  bcrypt.genSalt(saltRounds, function(err, salt) {
    bcrypt.hash(password, salt, async function(err, hash) {
      // Store hash in database here
      passwordCodificado = hash;

      const carrito = await carritoController.create();
      
      nuevoUsuario = {
        nombre,
        password: passwordCodificado,
        email,
        age,
        address,
        phone: fullphone,
        picture: req.file.path,
        carritoid: carrito._id.toString()
      }
      
      const doc = new UserModel(nuevoUsuario);
      await doc.save();

      // Enviar mail
      mailTo({
        to: process.env.ADMIN_MAIL,
        subject: 'Nuevo Registro',
        message: `<div>Usuario creado: 
          Nombre: ${nuevoUsuario.nombre} <br>
          Email: ${nuevoUsuario.email} <br>
          Edad: ${nuevoUsuario.age} <br>
          Dirección: ${nuevoUsuario.address} <br>
          Teléfono: ${nuevoUsuario.phone} <br>
        </div>`
      })
    });
  });
      
  const access_token = generateToken(nuevoUsuario)

  res.render('index', {token: access_token, nombre, picture: req.file.path });
})

app.get('/registro', (req, res) => {
  loggerBase(req)
  res.render('registro');
});

app.get('/productos', async (req, res) => {
  loggerBase(req)
  try {
    const productos_raw = await new ControladorProducto().listarAll();

    const productos = productos_raw.map((producto, index) => ({
      id: index + 1,
      originalId: producto.id,
      name: producto.name,
      price: producto.price
    }));

    res.render('productos', { productos });
  } catch (error) {
    loggerError(error);
  }
});

app.get('/carrito', auth, async (req, res) => {
  loggerBase(req)
  try {
    const carrito = await new ControladorCarrito().getCarritoById(req.user.carritoid);
  
    const responseObject = {
      carritos: [carrito]
    };

    if (typeof req.query.info !== 'undefined' && req.query.info === 'compra'){
      responseObject['info'] = 'Compra exitosa!';
    }

    res.render('carrito', responseObject);
  } catch (error) {
    loggerError(error);
  }
});

app.get('/comprar', auth, async (req, res) => {
  loggerBase(req)

  // carrito del usuario actual
  const carritoActual = await new ControladorCarrito().getCarritoById(req.user.carritoid);

  //crear lista de productos del usuario
  let mailContent = '';

  for (const prod of carritoActual.productos) {
    mailContent += `
      <li>${prod.name} ${prod.price}</li>
    `;
  }

  let whatsappContent = '';

  for (const prod of carritoActual.productos) {
    whatsappContent += `
      ${prod.name} ${prod.price}
    `;
  }
  
  await carritoController.removeAllProductsFromCar(req.user.carritoid).then(async (_any) => {

    mailTo({
      to: process.env.ADMIN_MAIL,
      subject: `Nuevo pedido de ${req.user.nombre} ${req.user.email}`,
      message: `<div>Productos: 
        <ul>
          ${mailContent}
        </ul>
      </div>`
    });

    const options = {
      body: `Nuevo Pedido de ${req.user.nombre} ${req.user.email} 
      
      Productos: 
        ${whatsappContent}
      `,
      from: `whatsapp:+14155238886`,
      to: process.env.WHATSAPP_RECEPTOR ,
      //to: `whatsapp:+5491168826545`,
    }
    
    try {
      await client.messages.create(options)
    } catch (error) {
      console.log(error)
    }

    res.redirect('/carrito?info=compra');
  });

});


const infoCallback = (res, consolePrint) => {

  const testCompression = 'testCompression...'
  const longString = testCompression.repeat(10000)

  const resultado = {
    "argumentosEntrada": Object.keys(argumentosEntrada).length,
    "NombrePlataforma": process.platform, 
    "VersionNode": process.version, 
    "MemoriaTotalReservada": process.memoryUsage().rss, 
    "PathDeEjecucion": process.execPath, 
    "ProcessId": process.pid, 
    "CarpetaProyecto": appDir,
    "longString": longString
  };
  if (consolePrint) {
    console.log(resultado);
  }

  res.render('info',{resultado, nroProcesadores: require('os').cpus().length });

}

/* Ruta Info */
app.get('/info', async (req, res) => {
  loggerBase(req)
  infoCallback(res, false);

});

app.get('/infozip', compression(), async (req, res) => {
  loggerBase(req)
  infoCallback(res, true);
  
});



/* ------------------------------------------------------ */
/* Cargo los routers */

const withLogger = (req, res, next) => {
  req.logger = logger;
  req.loggerBase = loggerBase;
  req.loggerError = loggerError;
  req.loggerWarning = loggerWarning;
  next();
}

app.use('/api/productos', withLogger, routerProducto)
 
app.use('/api/carrito', withLogger, routerCarrito)

app.use('/api/randoms', withLogger, routerRandoms)

app.use(function(req, res) {
  // Invalid request
  const { originalUrl, method } = req
  loggerWarning(`Ruta ${method} ${originalUrl} no implementada`);
});

/* ------------------------------------------------------ */
/* Server Listen */

const { puerto, CLUSTER } = argumentosEntrada; 

if(CLUSTER.toLowerCase() === 'on'){
  // modo cluster
  const server = app.listen(puerto, () => {
    console.log(`Servidor escuchando en el puerto ${server.address().port} modo CLUSTER`)
  })
  server.on('error', error => console.log(`Error en servidor ${error}`))
  
  
} else {
  // modo fork

    if (cluster.isPrimary) {

      const numCPUs = require('os').cpus().length;

      for (let i = 0; i < numCPUs; i++) {
        cluster.fork()
        console.log('creando una instancia nueva...')
      }
    
      cluster.on('exit', worker => {
        console.log(
          'Worker',
          worker.process.pid,
          'died',
          new Date().toLocaleString()
        )
        cluster.fork()
      })

    } else {

      const server = app.listen(puerto, () => {
        console.log(`Servidor escuchando en el puerto ${server.address().port} - PID WORKER ${process.pid}`)
      })
      server.on('error', error => console.log(`Error en servidor ${error}`))

    }

}

