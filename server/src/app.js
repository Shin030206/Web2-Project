const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { notFound, errorHandler } = require('./middlewares/error');
const { conceptRouter, collectionRouter, addonRouter, voucherRouter } = require('./routes/catalog.route');

const app = express();

// CLIENT_URL có thể ghi nhiều domain, cách nhau bởi dấu phẩy. Bỏ trống = cho phép tất cả (khi dev)
const allowedOrigins = (process.env.CLIENT_URL || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
if (process.env.NODE_ENV !== "test") app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Đăng ký các Route Router (MCR)
app.use('/api/auth', require('./routes/auth.route'));
app.use('/api/packages', require('./routes/package.route'));
app.use('/api/concepts', conceptRouter);
app.use('/api/collections', collectionRouter);
app.use('/api/addons', addonRouter);
app.use('/api/vouchers', voucherRouter);
app.use('/api/slots', require('./routes/slot.route'));
app.use('/api/bookings', require('./routes/booking.route'));
app.use('/api/payments', require('./routes/payment.route'));
app.use('/api/admin', require('./routes/admin.route'));

app.get('/', (req, res) => {
  res.send('Ky Uc Studio Web server is processed for MongoDB');
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
