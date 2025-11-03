// /services/tradeService.js
const pool = require('../config/db');

class TradeService {
  /**
   * Lógica de negocio para comprar criptomonedas (RF3)
   */
  static async buyCrypto(userId, simbolo, cantidad_usd) {
    const montoCompra = parseFloat(cantidad_usd);
    
    // 1. Validar inputs (ahora lo hace el servicio)
    if (!simbolo || !montoCompra || montoCompra <= 0) {
      throw new Error('Datos de compra inválidos');
    }

    const client = await pool.connect();

    try {
      // 2. Iniciar la transacción
      await client.query('BEGIN');

      // 3. Obtener precio de la cripto
      const cryptoResult = await client.query(
        'SELECT id_criptomoneda, precio_actual FROM criptomoneda WHERE simbolo = $1',
        [simbolo]
      );

      if (cryptoResult.rows.length === 0) {
        throw new Error('Criptomoneda no encontrada');
      }

      const crypto = cryptoResult.rows[0];
      const precioUnitario = parseFloat(crypto.precio_actual);
      const criptoId = crypto.id_criptomoneda;
      
      const cantidadCripto = montoCompra / precioUnitario;

      // 4. Obtener saldo del usuario (y bloquear la fila)
      const userResult = await client.query(
        'SELECT saldo_virtual_usd FROM usuario WHERE id_usuario = $1 FOR UPDATE',
        [userId]
      );
      const saldoUsuario = parseFloat(userResult.rows[0].saldo_virtual_usd);

      // 5. Verificar fondos
      if (saldoUsuario < montoCompra) {
        throw new Error('Fondos insuficientes');
      }

      // 6. Ejecutar operaciones
      const nuevoSaldo = saldoUsuario - montoCompra;
      await client.query(
        'UPDATE usuario SET saldo_virtual_usd = $1 WHERE id_usuario = $2',
        [nuevoSaldo, userId]
      );

      await client.query(
        `INSERT INTO transaccion (usuario_id, criptomoneda_id, tipo, cantidad, precio_unitario)
         VALUES ($1, $2, 'compra', $3, $4)`,
        [userId, criptoId, cantidadCripto.toFixed(8), precioUnitario]
      );

      // 7. Confirmar la transacción
      await client.query('COMMIT');

      // 8. Devolver un resultado exitoso
      return { 
        msg: 'Compra exitosa',
        simbolo: simbolo,
        cantidad_comprada: cantidadCripto.toFixed(8),
        gastado_usd: montoCompra,
        nuevo_saldo_usd: nuevoSaldo
      };

    } catch (err) {
      // 9. Si algo falla, revertir todo
      await client.query('ROLLBACK');
      // 10. Lanzar el error para que el controlador lo atrape
      throw err; 
    } finally {
      // 11. Siempre liberar el cliente
      client.release();
    }
  }

  /**
   * Lógica de negocio para vender criptomonedas (RF3)
   */
  static async sellCrypto(userId, simbolo, cantidad_cripto) {
    const montoVentaCripto = parseFloat(cantidad_cripto);
    
    if (!simbolo || !montoVentaCripto || montoVentaCripto <= 0) {
      throw new Error('Datos de venta inválidos');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const cryptoResult = await client.query(
        'SELECT id_criptomoneda, precio_actual FROM criptomoneda WHERE simbolo = $1',
        [simbolo]
      );

      if (cryptoResult.rows.length === 0) {
        throw new Error('Criptomoneda no encontrada');
      }

      const crypto = cryptoResult.rows[0];
      const precioUnitario = parseFloat(crypto.precio_actual);
      const criptoId = crypto.id_criptomoneda;
      const montoVentaUSD = montoVentaCripto * precioUnitario;

      const tenenciaResult = await client.query(
        `SELECT SUM(CASE WHEN tipo = 'compra' THEN cantidad ELSE -cantidad END) as tenencia_total
         FROM transaccion
         WHERE usuario_id = $1 AND criptomoneda_id = $2
         GROUP BY criptomoneda_id`,
        [userId, criptoId]
      );
        
      const tenenciaActual = (tenenciaResult.rows.length > 0) ? parseFloat(tenenciaResult.rows[0].tenencia_total) : 0;

      if (tenenciaActual < montoVentaCripto) {
        throw new Error('Tenencia de criptomoneda insuficiente');
      }

      const userResult = await client.query(
        'SELECT saldo_virtual_usd FROM usuario WHERE id_usuario = $1 FOR UPDATE',
        [userId]
      );
      const saldoUsuario = parseFloat(userResult.rows[0].saldo_virtual_usd);
      const nuevoSaldo = saldoUsuario + montoVentaUSD;

      await client.query(
        'UPDATE usuario SET saldo_virtual_usd = $1 WHERE id_usuario = $2',
        [nuevoSaldo, userId]
      );

      await client.query(
        `INSERT INTO transaccion (usuario_id, criptomoneda_id, tipo, cantidad, precio_unitario)
         VALUES ($1, $2, 'venta', $3, $4)`,
        [userId, criptoId, montoVentaCripto, precioUnitario]
      );

      await client.query('COMMIT');
      
      return {
        msg: 'Venta exitosa',
        simbolo: simbolo,
        cantidad_vendida: montoVentaCripto,
        recibido_usd: montoVentaUSD.toFixed(2),
        nuevo_saldo_usd: nuevoSaldo.toFixed(2)
      };

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Lógica de negocio para obtener historial (RF4)
   */
  static async getHistory(userId) {
    try {
      const history = await pool.query(
        `SELECT t.tipo, t.cantidad, t.precio_unitario, t.fecha_transaccion, c.simbolo
         FROM transaccion t
         JOIN criptomoneda c ON t.criptomoneda_id = c.id_criptomoneda
         WHERE t.usuario_id = $1
         ORDER BY t.fecha_transaccion DESC`,
        [userId]
      );
      return history.rows;
    } catch (err) {
      throw err;
    }
  }
}

module.exports = TradeService;