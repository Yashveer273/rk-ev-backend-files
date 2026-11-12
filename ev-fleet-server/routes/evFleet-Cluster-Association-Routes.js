const express = require('express');
const router = express.Router();

// कंट्रोलर को सही पाथ के साथ इम्पोर्ट करें (अपने फोल्डर स्ट्रक्चर के अनुसार पाथ एडजस्ट कर लें)
const evFleetController = require('../controllers/ev-fleet-clustor-association');

// GET API राउट: सभी केसेस, स्टेटस और पेजिनेशन को हैंडल करने के लिए
router.get('/evs/filter-cases', evFleetController.getEvsByCases);

module.exports = router;