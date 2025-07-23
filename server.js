const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
require('dotenv').config();

const app = express();

// Configuración básica
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'HTML')));

// Configuración de multer para subir archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'IMG/avatars/')); // Carpeta para avatars
  },
  filename: function (req, file, cb) {
    cb(null, `${req.session.userId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage: storage });

// Configuración de sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'pixelpioneer_secret_key_12345',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Cambiar a true en producción con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 día
    sameSite: 'lax',
    domain: 'localhost'
  }
}));

// Configuración CORS para desarrollo
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Configuración de rutas estáticas
app.use('/CSS', express.static(path.join(__dirname, 'CSS')));
app.use('/IMG', express.static(path.join(__dirname, 'IMG')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/HTML', express.static(path.join(__dirname, 'HTML')));

// Base de datos SQLite
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      pais TEXT,
      departamento TEXT,
      fecha_nacimiento TEXT,
      municipio TEXT,
      telefono TEXT,
      tarjeta_seleccionada TEXT,
      numero_tarjeta TEXT,
      guardar_datos INTEGER,
      fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
      ultimo_login TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS perfiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER UNIQUE,
      username TEXT UNIQUE,
      descripcion TEXT,
      juego_favorito TEXT,
      mejor_amigo TEXT,
      hashtags TEXT,
      avatar_url TEXT,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_email ON usuarios(email)`);

    // Insertar datos iniciales si no existen
    db.get('SELECT COUNT(*) as count FROM usuarios', (err, row) => {
      if (err) {
        console.error('Error verificando usuarios:', err);
      } else if (row.count === 0) {
        const hashedPassword = bcrypt.hashSync('password123', 10);
        db.run(
          `INSERT INTO usuarios (nombre, apellidos, email, password, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)`,
          ['Player', '', 'player@example.com', hashedPassword, '2006-07-22'],
          (err) => {
            if (err) console.error('Error inserting user:', err);
            else {
              const userId = this.lastID;
              db.run(
                `INSERT INTO perfiles (usuario_id, username, descripcion, juego_favorito, mejor_amigo, hashtags, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, '@player503071702', 'Me gusta jugar videojuegos en mi tiempo libre.', 'Fatal Fury', 'Gabriela', '#Xbox #Segaa #Fortnite #Nintendo #Playstation', '../IMG/foto_de_perfil.png'],
                (err) => {
                  if (err) console.error('Error inserting profile:', err);
                }
              );
            }
          }
        );
      }
    });
  });
}

// Middleware de autenticación
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado',
      code: 'UNAUTHORIZED'
    });
  }
  next();
}

// Ruta para verificar si hay usuarios registrados
app.get('/check-users', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM usuarios', (err, row) => {
    if (err) {
      console.error('Error verificando usuarios:', err);
      return res.status(500).json({
        success: false,
        message: 'Error en el servidor',
        code: 'SERVER_ERROR'
      });
    }
    res.json({
      success: true,
      hasUsers: row.count > 0
    });
  });
});

// Rutas de autenticación
app.get('/check-auth', (req, res) => {
  if (!req.session.userId) {
    return res.json({ isAuthenticated: false });
  }

  db.get('SELECT id, email FROM usuarios WHERE id = ?', [req.session.userId], (err, user) => {
    if (err || !user) {
      return res.json({ isAuthenticated: false });
    }

    db.run('UPDATE usuarios SET ultimo_login = datetime("now") WHERE id = ?', [user.id]);
    res.json({
      isAuthenticated: true,
      userId: user.id,
      email: user.email
    });
  });
});

// Ruta de perfil
app.get('/perfil', requireLogin, (req, res) => {
  const userId = req.session.userId;

  db.get(`
    SELECT u.*, p.username, p.descripcion, p.juego_favorito, p.mejor_amigo, p.hashtags, p.avatar_url
    FROM usuarios u
    LEFT JOIN perfiles p ON u.id = p.usuario_id
    WHERE u.id = ?
  `, [userId], (err, data) => {
    if (err || !data) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const { password, numero_tarjeta, ...safeData } = data;
    res.json({
      success: true,
      data: safeData
    });
  });
});

// Ruta para actualizar perfil
app.put('/perfil', requireLogin, (req, res) => {
  const userId = req.session.userId;
  const { username, descripcion, juego_favorito, mejor_amigo, hashtags } = req.body;

  db.get('SELECT usuario_id FROM perfiles WHERE usuario_id = ?', [userId], (err, profile) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error en el servidor',
        code: 'SERVER_ERROR'
      });
    }

    if (profile) {
      db.run(
        `UPDATE perfiles SET username = ?, descripcion = ?, juego_favorito = ?, mejor_amigo = ?, hashtags = ? WHERE usuario_id = ?`,
        [username || '@player503071702', descripcion || 'Me gusta jugar videojuegos en mi tiempo libre.', juego_favorito || 'Fatal Fury', mejor_amigo || 'Gabriela', hashtags || '#Xbox #Segaa #Fortnite #Nintendo #Playstation', userId],
        (err) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Error actualizando perfil',
              code: 'UPDATE_ERROR'
            });
          }
          res.json({ success: true, message: 'Perfil actualizado correctamente' });
        }
      );
    } else {
      db.run(
        `INSERT INTO perfiles (usuario_id, username, descripcion, juego_favorito, mejor_amigo, hashtags, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, username || '@player503071702', descripcion || 'Me gusta jugar videojuegos en mi tiempo libre.', juego_favorito || 'Fatal Fury', mejor_amigo || 'Gabriela', hashtags || '#Xbox #Segaa #Fortnite #Nintendo #Playstation', '../IMG/foto_de_perfil.png'],
        (err) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Error creando perfil',
              code: 'INSERT_ERROR'
            });
          }
          res.json({ success: true, message: 'Perfil creado correctamente' });
        }
      );
    }
  });
});

// Ruta para subir avatar
app.post('/perfil/avatar', requireLogin, upload.single('avatar'), (req, res) => {
  const userId = req.session.userId;
  const avatarUrl = `/IMG/avatars/${req.file.filename}`;

  db.run(
    `UPDATE perfiles SET avatar_url = ? WHERE usuario_id = ?`,
    [avatarUrl, userId],
    (err) => {
      if (err) {
        console.error('Error updating avatar:', err);
        return res.status(500).json({
          success: false,
          message: 'Error al actualizar la foto de perfil',
          code: 'UPDATE_ERROR'
        });
      }
      res.json({
        success: true,
        message: 'Foto de perfil actualizada',
        avatarUrl: avatarUrl
      });
    }
  );
});

// Ruta de login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Credenciales requeridas',
      code: 'MISSING_CREDENTIALS'
    });
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Correo electrónico inválido',
      code: 'INVALID_EMAIL'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'La contraseña debe tener al menos 8 caracteres',
      code: 'INVALID_PASSWORD'
    });
  }

  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, email, password, nombre, apellidos FROM usuarios WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    req.session.userId = user.id;
    req.session.lastActive = new Date();

    await new Promise((resolve, reject) => {
      db.run('UPDATE usuarios SET ultimo_login = datetime("now") WHERE id = ?', [user.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      success: true,
      message: 'Login exitoso',
      redirect: '/HTML/index5.html',
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellidos: user.apellidos
      }
    });
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      code: 'SERVER_ERROR'
    });
  }
});

// Ruta de registro
app.post('/registrar', async (req, res) => {
  const {
    nombre, apellidos, email, password, pais, departamento,
    fechaNacimiento, municipio, telefono, tarjetaSeleccionada,
    numeroTarjeta, guardarDatos
  } = req.body;

  if (!nombre || !apellidos || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Campos obligatorios faltantes',
      code: 'MISSING_FIELDS'
    });
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Correo electrónico inválido',
      code: 'INVALID_EMAIL'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'La contraseña debe tener al menos 8 caracteres',
      code: 'INVALID_PASSWORD'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO usuarios (nombre, apellidos, email, password, pais, departamento, fecha_nacimiento, municipio, telefono, tarjeta_seleccionada, numero_tarjeta, guardar_datos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      nombre, apellidos, email, hashedPassword, pais, departamento,
      fechaNacimiento, municipio, telefono, tarjetaSeleccionada, numeroTarjeta,
      guardarDatos ? 1 : 0
    ];

    await new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed: usuarios.email')) {
            return reject(new Error('El correo ya está registrado'));
          }
          return reject(err);
        }
        req.session.userId = this.lastID;
        resolve();
      });
    });

    res.json({
      success: true,
      message: 'Registro exitoso',
      redirect: '/HTML/index5.html',
      userId: req.session.userId
    });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error en el servidor',
      code: 'SERVER_ERROR'
    });
  }
});

// Ruta para cambiar contraseña
app.post('/cambiar-password', requireLogin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.session.userId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Se requieren ambas contraseñas',
      code: 'MISSING_FIELDS'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'La nueva contraseña debe tener al menos 8 caracteres',
      code: 'INVALID_PASSWORD'
    });
  }

  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT password FROM usuarios WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await new Promise((resolve, reject) => {
      db.run('UPDATE usuarios SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      success: true,
      message: 'Contraseña cambiada exitosamente'
    });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      code: 'SERVER_ERROR'
    });
  }
});

// Ruta de logout
app.post('/logout', requireLogin, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error al destruir sesión:', err);
      return res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión',
        code: 'LOGOUT_ERROR'
      });
    }

    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente',
      redirect: '/HTML/index3.html'
    });
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Crear carpeta para avatars si no existe
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'IMG/avatars'))) {
  fs.mkdirSync(path.join(__dirname, 'IMG/avatars'));
}