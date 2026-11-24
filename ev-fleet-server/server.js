const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();
const app = express();

connectDB();

app.use(express.json());
app.use(cors());  


 const evMarketplaceInvestorRoutes = require('./routes/evMarketplace_investor.routes');
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/evFleet-Cluster-Association', require('./routes/evFleet-Cluster-Association-Routes'));
app.use('/api/vehicle-assign-closter-info', require('./routes/evClusterAssigningRoutes'));
app.use('/api/investor_EV', evMarketplaceInvestorRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Server Error' });
});
const HOST = process.env.HOST || "192.168.1.8";
const PORT = process.env.PORT || 5003;
app.listen(PORT,HOST, () => {
  console.log(`EV Fleet Server running on port ${PORT} ${HOST}`);
});
