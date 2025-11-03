// /services/aiService.js
const pool = require('../config/db');
const OllamaAdapter = require('./aiAdapters/ollamaAdapter');
// const OpenAIAdapter = require('./aiAdapters/openAIAdapter'); //

//esta funcion sirve para obtener los datos del portafolio del usuario mediante su ID
async function getPortafolioData(userId) {
  try {
    const saldoResult = await pool.query(
      'SELECT saldo_virtual_usd FROM usuario WHERE id_usuario = $1',
      [userId]
    );
    const saldo_usd = parseFloat(saldoResult.rows[0].saldo_virtual_usd);

    const tenenciasResult = await pool.query(
      `SELECT 
         c.simbolo, c.precio_actual,
         SUM(CASE WHEN t.tipo = 'compra' THEN t.cantidad ELSE -t.cantidad END) as tenencia_total
       FROM transaccion t
       JOIN criptomoneda c ON t.criptomoneda_id = c.id_criptomoneda
       WHERE t.usuario_id = $1
       GROUP BY c.id_criptomoneda, c.simbolo, c.precio_actual
       HAVING SUM(CASE WHEN t.tipo = 'compra' THEN t.cantidad ELSE -t.cantidad END) > 0.000001`,
      [userId]
    );

    let valor_total_criptos = 0;
    const criptomonedas = tenenciasResult.rows.map(cripto => {
      const valor_actual = parseFloat(cripto.tenencia_total) * parseFloat(cripto.precio_actual);
      valor_total_criptos += valor_actual;
      return {
        simbolo: cripto.simbolo,
        cantidad: parseFloat(cripto.tenencia_total).toFixed(8),
        valor_usd: valor_actual.toFixed(2)
      };
    });

    return {
      saldo_usd: saldo_usd.toFixed(2),
      criptomonedas: criptomonedas,
      valor_total_portafolio: (valor_total_criptos + saldo_usd).toFixed(2)
    };
  } catch (err) {
    console.error("Error al obtener portafolio para IA:", err);
    throw new Error('Error interno al obtener el portafolio');
  }
}


class AIService {
  constructor() {
    // Inicializar el adaptador de IA (aquí usamos Ollama como ejemplo)
    this.adapter = new OllamaAdapter();
    console.log('Servicio de IA inicializado con: Ollama (Local)');
  }

  /**
   * Generamos una respuesta de IA basada en la pregunta del usuario y su portafolio
   */
  async askAI(userId, pregunta) {
    const portafolio = await getPortafolioData(userId);
    if (!portafolio) {
      throw new Error('No se pudo obtener el portafolio');
    }
    const contextoPortafolio = JSON.stringify(portafolio, null, 2);

    // Construimos los mensajes para el modelo de IA
    const systemPrompt = `
      Eres "CryptoAsesor", un asistente financiero experto en criptomonedas.
      Tu propósito es educar y asistir a un usuario en una plataforma de simulación.
      Tus respuestas deben ser educativas, neutrales y siempre recordar al usuario que esto es una simulación.
      Si te preguntan por tu nombre, eres "CryptoAsesor".
    `;
    // Construimos el prompt del usuario con el contexto del portafolio
    const userPrompt = `
      Este es mi portafolio de simulación actual:
      ${contextoPortafolio}

      Mi pregunta es:
      "${pregunta}"
    `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    return this.adapter.generarRespuesta(messages);
  }
}

// Exportamos una instancia del servicio de IA
module.exports = new AIService();