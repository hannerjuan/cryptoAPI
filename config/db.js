// /config/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Lee las variables de entorno para la conexión
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Exportamos 'pool' para poder hacer consultas desde otros archivos
module.exports = pool;