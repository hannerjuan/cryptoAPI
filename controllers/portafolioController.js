// /controllers/portafolioController.js
const pool = require('../config/db');

exports.getPortafolio = async (req, res) => {
  try {
    const userId = req.user.id; // ID del usuario logueado

    // 1. Obtener el saldo virtual actual del usuario
    const saldoResult = await pool.query(
      'SELECT saldo_virtual_usd FROM usuario WHERE id_usuario = $1',
      [userId]
    );
    const saldo_usd = saldoResult.rows[0].saldo_virtual_usd;

    // 2. Calcular las tenencias de criptomonedas (usando la lógica de SUM/CASE)
    const tenenciasResult = await pool.query(
      `SELECT 
         c.simbolo, 
         c.nombre,
         c.precio_actual,
         SUM(CASE WHEN t.tipo = 'compra' THEN t.cantidad ELSE -t.cantidad END) as tenencia_total
       FROM transaccion t
       JOIN criptomoneda c ON t.criptomoneda_id = c.id_criptomoneda
       WHERE t.usuario_id = $1
       GROUP BY c.id_criptomoneda, c.simbolo, c.nombre, c.precio_actual
       HAVING SUM(CASE WHEN t.tipo = 'compra' THEN t.cantidad ELSE -t.cantidad END) > 0`, // Solo mostrar las que tiene
      [userId]
    );

    // 3. Calcular el valor total del portafolio
    let valor_total_criptos = 0;
    const criptomonedas = tenenciasResult.rows.map(cripto => {
      const valor_actual = parseFloat(cripto.tenencia_total) * parseFloat(cripto.precio_actual);
      valor_total_criptos += valor_actual;
      return {
        ...cripto,
        valor_actual: valor_actual.toFixed(2)
      };
    });

    const valor_total_portafolio = valor_total_criptos + parseFloat(saldo_usd);

    // 4. Devolver la respuesta
    res.json({
      saldo_virtual_usd: parseFloat(saldo_usd).toFixed(2),
      criptomonedas: criptomonedas,
      valor_total_criptos: valor_total_criptos.toFixed(2),
      valor_total_portafolio: valor_total_portafolio.toFixed(2)
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
};