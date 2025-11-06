// /services/aiService.js
const OllamaAdapter = require('./aiAdapters/ollamaAdapter');
// Importar las nuevas estrategias
const GeneralStrategy = require('./aiStrategies/GeneralStrategy');
const PortfolioStrategy = require('./aiStrategies/PortfolioStrategy');

// --- BORRAMOS LA FUNCIÓN getPortafolioData() DE AQUÍ ---

class AIService {
  constructor() {
    // 1. El adaptador sigue igual
    this.adapter = new OllamaAdapter();
    console.log('Servicio de IA inicializado con: Ollama (Local)');

    // 2. Creamos instancias de nuestras estrategias
    this.strategies = {
      general: new GeneralStrategy(),
      portafolio: new PortfolioStrategy()
    };
  }

  /**
   * Lógica de negocio para preguntar a la IA (ahora actúa como "Contexto")
   * @param {string} userId - ID del usuario
   * @param {string} pregunta - La pregunta
   * @param {string} tipo - 'general' o 'portafolio'
   */
  async askAI(userId, pregunta, tipo = 'general') {
    // 3. SELECCIONAR LA ESTRATEGIA
    let strategy = this.strategies[tipo];

    // Si el tipo no es válido, usamos 'general' por defecto
    if (!strategy) {
      console.warn(`Tipo de estrategia no válido: "${tipo}". Usando 'general' por defecto.`);
      strategy = this.strategies.general;
    }

    // 4. CONSTRUIR LOS PROMPTS
    // El servicio no sabe CÓMO se construyen los prompts, solo delega
    // a la estrategia seleccionada.
    const messages = await strategy.buildPrompts(pregunta, userId);

    // 5. LLAMAR AL ADAPTADOR (esta parte no cambia)
    return this.adapter.generarRespuesta(messages);
  }
}

module.exports = new AIService();