const { collections, ObjectId } = require('../config/db');

// 1. LẤY TẤT CẢ CONCEPTS (Kèm lọc theo category / tag)
exports.getAllConcepts = async (req, res) => {
  try {
    const { category, tag, search } = req.query;
    let query = {};

    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
    }
    if (tag) {
      query.tag = { $regex: new RegExp(tag, 'i') };
    }
    if (search) {
      query.$or = [
        { concept_name: { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } }
      ];
    }

    const result = await collections.conceptCollection.find(query).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// 2. CHI TIẾT CONCEPT (Hỗ trợ theo code hoặc id)
exports.getConceptByCode = async (req, res) => {
  try {
    const code = req.params["code"];
    let query = code.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: new ObjectId(code) } 
      : { concept_code: { $regex: new RegExp('^' + code + '$', 'i') } };

    const result = await collections.conceptCollection.findOne(query);
    if (!result) {
      // Thử tìm theo slug trong tên
      const byName = await collections.conceptCollection.findOne({
        concept_name: { $regex: new RegExp(code.replace(/-/g, ' '), 'i') }
      });
      return res.send(byName || { message: "Concept not found" });
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

