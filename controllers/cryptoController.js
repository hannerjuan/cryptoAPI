// /controllers/cryptoController.js
const pool = require('../config/db');
const axios = require('axios');

// (RF2) Lee los precios desde NUESTRA base de datos
exports.getPrices = async (req, res) => {
  try {
    const prices = await pool.query(
      'SELECT simbolo, nombre, precio_actual FROM criptomoneda'
    );
    res.json(prices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
};

// (RNF2) Actualiza los precios en nuestra BD desde una API externa (CoinGecko)
exports.updatePricesFromApi = async (req, res) => {
  try {
    // IDs de las criptos que tenemos en nuestra BD (según CoinGecko)
    const cryptoIds = 'bitcoin,ethereum'; 

    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=usd`
    );

    const prices = response.data;

    // Actualizar precios en nuestra BD
    const btcPrice = prices.bitcoin.usd;
    const ethPrice = prices.ethereum.usd;

    await pool.query('UPDATE criptomoneda SET precio_actual = $1 WHERE simbolo = $2', [btcPrice, 'BTC']);
    await pool.query('UPDATE criptomoneda SET precio_actual = $1 WHERE simbolo = $2', [ethPrice, 'ETH']);

    res.json({ msg: 'Precios actualizados', btc: btcPrice, eth: ethPrice });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor al actualizar precios');
  }
};