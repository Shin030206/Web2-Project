const { collections, ObjectId } = require('../config/db');

// LẤY TẤT CẢ COLLECTIONS
exports.getAllCollections = async (req, res) => {
  try {
    const result = await collections.collectionCollection.find({}).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// CHI TIẾT COLLECTION THEO ID
exports.getCollectionById = async (req, res) => {
  try {
    const id = req.params["id"];
    const result = await collections.collectionCollection.findOne({ collection_id: id });
    res.send(result || { message: "Collection not found" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

