const { collections } = require('../config/db');
const { httpError, identifierQuery } = require('./helpers');
const { isAdmin } = require('../middlewares/auth');

// Ép kiểu + chỉ giữ các field được khai báo trong schema (tránh client ghi linh tinh vào DB)
function sanitize(body, schema, { partial }) {
  const data = {};
  for (const [field, rule] of Object.entries(schema)) {
    let value = body[field];
    if (value === undefined) {
      if (!partial && rule.default !== undefined) data[field] = rule.default;
      continue;
    }
    if (rule.type === "number") {
      value = Number(value);
      if (isNaN(value) || value < 0) throw httpError(400, `${field} phải là số không âm!`);
    } else if (rule.type === "boolean") {
      value = value === true || value === "true";
    } else if (rule.type === "array") {
      if (!Array.isArray(value)) throw httpError(400, `${field} phải là một mảng!`);
    } else {
      value = String(value).trim();
      if (rule.upper) value = value.toUpperCase();
      if (rule.enum && !rule.enum.includes(value)) throw httpError(400, `${field} chỉ nhận: ${rule.enum.join(", ")}`);
    }
    data[field] = value;
  }

  if (!partial) {
    const missing = Object.entries(schema).filter(([f, r]) => r.required && (data[f] === undefined || data[f] === "")).map(([f]) => f);
    if (missing.length) throw httpError(400, `Vui lòng nhập đầy đủ thông tin bắt buộc: ${missing.join(", ")}`);
  }
  return data;
}

/**
 * Tạo bộ controller CRUD cho 1 collection.
 * options:
 *  - collection: tên key trong collections (vd "conceptCollection")
 *  - idField / numericId: mã nghiệp vụ (vd concept_code)
 *  - schema: { field: { type, required, default, enum } }
 *  - buildFilter(query): lọc cho API danh sách
 *  - activeFilter: điều kiện ẩn bản ghi đã ngừng hoạt động với khách
 *  - sort, label, beforeDelete(doc)
 */
function makeCrud(options) {
  const { idField, numericId, schema, label, sort = { [idField]: 1 } } = options;
  const col = () => collections[options.collection];
  const findQuery = (identifier) => identifierQuery(identifier, idField, numericId);

  return {
    list: async (req, res) => {
      const filter = options.buildFilter ? options.buildFilter(req.query) : {};
      if (options.activeFilter && !(isAdmin(req) && req.query.all === "true")) Object.assign(filter, options.activeFilter);
      res.send(await col().find(filter).sort(sort).toArray());
    },

    getOne: async (req, res) => {
      const doc = await col().findOne(findQuery(req.params.id));
      if (!doc) throw httpError(404, `Không tìm thấy ${label}!`);
      res.send(doc);
    },

    create: async (req, res) => {
      const data = sanitize(req.body, schema, { partial: false });
      data.createdAt = new Date();
      data.updatedAt = new Date();
      const result = await col().insertOne(data);
      res.status(201).send({ ...data, _id: result.insertedId });
    },

    update: async (req, res) => {
      const data = sanitize(req.body, schema, { partial: true });
      data.updatedAt = new Date();
      const result = await col().findOneAndUpdate(findQuery(req.params.id), { $set: data }, { returnDocument: "after" });
      if (!result) throw httpError(404, `Không tìm thấy ${label}!`);
      res.send(result);
    },

    remove: async (req, res) => {
      const doc = await col().findOne(findQuery(req.params.id));
      if (!doc) throw httpError(404, `Không tìm thấy ${label}!`);
      if (options.beforeDelete) await options.beforeDelete(doc);
      await col().deleteOne({ _id: doc._id });
      res.send(doc);
    }
  };
}

module.exports = { makeCrud, sanitize };
