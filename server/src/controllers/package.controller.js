// 1. LẤY TẤT CẢ GÓI CHỤP (Kèm lọc khoảng giá min/max)
const { collections, ObjectId } = require('../config/db');

// Lấy danh sách gói chụp (kèm lọc min/max price)
exports.getAllPackages = async (req, res) => {
  try {
    const { minPrice, maxPrice, category } = req.query;
    let query = {};

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (category) {
      query.category = category;
    }

    const result = await collections.packageCollection.find(query).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Chi tiết gói chụp (hỗ trợ ID và Slug)
exports.getPackageByIdentifier = async (req, res) => {
  try {
    const id = req.params["identifier"];
    let query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: new ObjectId(id) } : { slug: id };

    const result = await collections.packageCollection.find(query).toArray();
    res.send(result[0] || null);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Thêm gói mới
exports.createPackage = async (req, res) => {
  try {
    await collections.packageCollection.insertOne(req.body);
    res.send(req.body);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Cập nhật gói
exports.updatePackage = async (req, res) => {
  try {
    const o_id = new ObjectId(req.body._id);
    let updateData = { ...req.body };
    delete updateData._id;

    await collections.packageCollection.updateOne({ _id: o_id }, { $set: updateData });
    const result = await collections.packageCollection.find({ _id: o_id }).toArray();
    res.send(result[0]);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Xóa gói
exports.deletePackage = async (req, res) => {
  try {
    const o_id = new ObjectId(req.params["id"]);
    const result = await collections.packageCollection.find({ _id: o_id }).toArray();
    await collections.packageCollection.deleteOne({ _id: o_id });
    res.send(result[0]);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};