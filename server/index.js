const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./src/config/db');

const app = express();
const port = process.env.PORT || 3005;

// Middleware theo bài Thầy dạy
app.use(morgan('combined'));
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Khởi chạy kết nối CSDL MongoDB Atlas
connectDB();

// Đăng ký các Route Router (MCR)
app.use('/packages', require('./src/routes/package.route'));
app.use('/slots', require('./src/routes/slot.route'));
app.use('/bookings', require('./src/routes/booking.route'));
app.use('/payments', require('./src/routes/payment.route'));

app.get('/', (req, res) => {
  res.send('Ky Uc Studio Web server is processed for MongoDB');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});