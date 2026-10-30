const { collections } = require('../config/db');

// LẤY TẤT CẢ ADDONS
exports.getAllAddons = async (req, res) => {
  try {
    const result = await collections.addonCollection.find({}).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

