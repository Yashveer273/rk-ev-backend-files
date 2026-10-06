// सुपर एडमिन वेरीफिकेशन मिडलवेयर
exports.verifySuperAdmin = (req, res, next) => {
  try {
    const role = req.headers['x-user-role']; // हेडर या ऑथ टोकन से रोल प्राप्त करें
    
    if (role !== 'super-admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Super Admin can perform this action." 
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// क्लस्टर ओनर / मैनेजर वेरीफिकेशन मिडलवेयर
exports.verifyClusterOwner = (req, res, next) => {
  try {
    const role = req.headers['x-user-role'];
    const clusterOwnerId = req.headers['x-owner-id']; // ओनर या क्लस्टर आईडी

    if (role !== 'cluster-owner' && role !== 'super-admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Cluster Owner or Super Admin can manage vehicles." 
      });
    }
    
    // रिक्वेस्ट ऑब्जेक्ट में ओनर आईडी अटैच कर सकते हैं
    req.clusterOwnerId = clusterOwnerId;
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};