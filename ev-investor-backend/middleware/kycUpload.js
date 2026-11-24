const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads', 'kyc');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const hasUnsafeFileName = (filename = '') => {
  const lower = String(filename).toLowerCase().trim();
  if (!lower || lower.includes('\0')) return true;
  if (lower.includes('..') || lower.includes('/') || lower.includes('\\')) {
    return true;
  }

  const dangerous =
    /\.(php|phtml|phar|exe|sh|bat|cmd|js|mjs|cjs|ts|html|htm|svg|xml|jsp|asp|aspx|py|rb|pl|scr|dll|so|apk|aab)(\.|$)/i;
  return dangerous.test(lower);
};

const detectImageTypeFromMagicBytes = (filePath) => {
  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, header, 0, 12, 0);
    if (bytesRead < 3) return null;

    // JPEG: FF D8 FF
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return 'jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytesRead >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    ) {
      return 'png';
    }

    // WEBP: "RIFF" at 0..3 and "WEBP" at 8..11
    if (
      bytesRead >= 12 &&
      header.toString('ascii', 0, 4) === 'RIFF' &&
      header.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'webp';
    }

    return null;
  } catch (_) {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {}
    }
  }
};

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {}
};

const cleanupUploadedFiles = (filesObj) => {
  if (!filesObj || typeof filesObj !== 'object') return;
  for (const fieldFiles of Object.values(filesObj)) {
    if (!Array.isArray(fieldFiles)) continue;
    for (const file of fieldFiles) {
      safeUnlink(file?.path);
    }
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
    const investorKey = String(
      req.investor?.investorId || req.investor?._id || 'inv'
    ).replace(/[^a-zA-Z0-9_-]/g, '');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${file.fieldname}-${investorKey}-${unique}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  if (hasUnsafeFileName(file.originalname)) {
    return cb(new Error('Invalid or unsafe file name'), false);
  }
  if (!ALLOWED_EXT.has(ext)) {
    return cb(
      new Error('Only .jpg, .jpeg, .png, or .webp files are allowed'),
      false
    );
  }
  if (!ALLOWED_MIME.has(mime)) {
    return cb(new Error('Invalid file MIME type'), false);
  }

  return cb(null, true);
};

const kycUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 2,
  },
}).fields([
  { name: 'panImage', maxCount: 1 },
  { name: 'aadhaarImage', maxCount: 1 },
]);

const validateSavedFiles = (filesObj) => {
  if (!filesObj || typeof filesObj !== 'object') return null;

  for (const [fieldName, fileList] of Object.entries(filesObj)) {
    if (!Array.isArray(fileList)) continue;
    for (const file of fileList) {
      if (!file?.path || !fs.existsSync(file.path)) {
        return `Uploaded file missing for ${fieldName}`;
      }

      const stat = fs.statSync(file.path);
      if (!stat.isFile() || stat.size <= 0) {
        return `Empty file is not allowed for ${fieldName}`;
      }
      if (stat.size > MAX_FILE_SIZE) {
        return `File size exceeds 5 MB limit for ${fieldName}`;
      }

      const detectedType = detectImageTypeFromMagicBytes(file.path);
      if (!detectedType) {
        return `Invalid or corrupted image content for ${fieldName}`;
      }

      const ext = path.extname(file.originalname || '').toLowerCase();
      if (
        (detectedType === 'jpeg' && ext !== '.jpg' && ext !== '.jpeg') ||
        (detectedType === 'png' && ext !== '.png') ||
        (detectedType === 'webp' && ext !== '.webp')
      ) {
        return `File extension does not match actual image format for ${fieldName}`;
      }
    }
  }

  return null;
};

const kycUploadMiddleware = (req, res, next) => {
  if (!req.investor || !req.investor._id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized investor session',
    });
  }

  kycUpload(req, res, (err) => {
    if (err) {
      cleanupUploadedFiles(req.files);

      let message = err.message || 'Invalid KYC document upload';
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          message = 'Each document image must be 5 MB or smaller';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          message = 'Maximum 2 KYC images can be uploaded';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          message = 'Only panImage and aadhaarImage fields are allowed';
        }
      }

      return res.status(400).json({
        success: false,
        message,
      });
    }

    const validationError = validateSavedFiles(req.files);
    if (validationError) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    return next();
  });
};

module.exports = { kycUploadMiddleware };