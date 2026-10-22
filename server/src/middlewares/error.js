exports.notFound = (req, res) => {
  res.status(404).send({ error: `Không tìm thấy API ${req.method} ${req.originalUrl}` });
};

// Express 5 tự chuyển lỗi của hàm async về đây, controller không cần try/catch
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message;

  if (err.code === 11000) {
    status = 409;
    message = "Dữ liệu bị trùng: " + Object.keys(err.keyValue || {}).join(", ");
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Body JSON không hợp lệ!";
  }

  if (status >= 500) console.error(err);
  res.status(status).send({ error: status >= 500 && process.env.NODE_ENV === "production" ? "Lỗi máy chủ!" : message });
};
