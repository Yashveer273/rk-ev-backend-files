const ENCRYPTION_KEY =  'a8f3c9e2b4d1f6a8c5e7b9d2f4a6c8e1b3d5f7a9c2e4b6d8f1a3c5e7b9d2f4a6';

const decryptToken = (encryptedBase64) => {
  try {
    const decodedString = atob(encryptedBase64); // या Buffer.from(encryptedBase64, 'base64').toString('binary')
    let decrypted = '';
    for (let i = 0; i < decodedString.length; i++) {
      const charCode = decodedString.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      decrypted += String.fromCharCode(charCode);
    }
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Decryption Error:", error.message);
    return null;
  }
};

exports.verifyEncryptionAuth = (req, res, next) => {
  const encryptedHeaderToken = req.headers['x-api-encrypted-key'];

  if (!encryptedHeaderToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing security token header' });
  }

  const decryptedData = decryptToken(encryptedHeaderToken);

  // यहाँ हमने decryptedData.data.client चेक किया है
  if (!decryptedData || !decryptedData.data || decryptedData.data.client !== 'EV_Fleet_Frontend') {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid or corrupted security token' });
  }

  // अगर आप आगे के मिडलवेर्स में डेटा इस्तेमाल करना चाहें:
  req.clientAuth = decryptedData.data;

  next();
};