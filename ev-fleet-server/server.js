const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();
const app = express();

connectDB();

app.use(express.json());
app.use(cors());

app.use('/api/vehicles', require('./routes/vehicleRoutes'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Server Error' });
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`EV Fleet Server running on port ${PORT}`);
});
