// /controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // <-- Importar JWT

// Constante para el rol de usuario (asumiendo que 'usuario' es el id 2)
const ROL_USUARIO = 2;
// Saldo virtual inicial
const SALDO_INICIAL = 100000.00;

/**
 * Controlador para registrar un nuevo usuario (RF1)
 */
exports.registerUser = async (req, res) => {
  const { nombre, correo_electronico, contrasena } = req.body;

  // 1. Validar inputs (básico)
  if (!nombre || !correo_electronico || !contrasena) {
    return res.status(400).json({ msg: 'Por favor, ingrese todos los campos' });
  }

  try {
    // 2. Verificar si el usuario ya existe
    const userExists = await pool.query(
      'SELECT * FROM usuario WHERE correo_electronico = $1',
      [correo_electronico]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ msg: 'El correo electrónico ya está registrado' });
    }

    // 3. Hashear la contraseña (¡Seguridad!)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(contrasena, salt);

    // 4. Insertar el nuevo usuario en la BD
    const newUser = await pool.query(
      `INSERT INTO usuario (nombre, correo_electronico, contrasena, rol_id, saldo_virtual_usd)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_usuario, nombre, correo_electronico, saldo_virtual_usd`,
      [nombre, correo_electronico, hashedPassword, ROL_USUARIO, SALDO_INICIAL]
    );

    // 5. Responder al frontend
    res.status(201).json({
      msg: 'Usuario registrado exitosamente',
      usuario: newUser.rows[0],
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
}; // <-- La llave que cierra registerUser

/**
 * Controlador para Iniciar Sesión (RF1)
 */
exports.loginUser = async (req, res) => {
  const { correo_electronico, contrasena } = req.body;

  // 1. Validar inputs
  if (!correo_electronico || !contrasena) {
    return res.status(400).json({ msg: 'Por favor, ingrese todos los campos' });
  }

  try {
    // 2. Buscar al usuario en la BD
    const user = await pool.query(
      'SELECT * FROM usuario WHERE correo_electronico = $1',
      [correo_electronico]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    // 3. Comparar la contraseña
    const dbUser = user.rows[0];
    const isMatch = await bcrypt.compare(contrasena, dbUser.contrasena);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    // 4. Crear el Payload del Token
    // Guardamos el ID del usuario y su rol en el token.
    const payload = {
      user: {
        id: dbUser.id_usuario,
        rol: dbUser.rol_id,
      },
    };

    // 5. Firmar y devolver el Token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' }, // El token expira en 24 horas
      (err, token) => {
        if (err) throw err;
        res.json({
          msg: 'Login exitoso',
          token: token,
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
};