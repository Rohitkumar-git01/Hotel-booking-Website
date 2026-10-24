import multer from "multer";
import { MAX_UPLOAD_BYTES } from "../utils/constants.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

// Files are kept in memory and streamed straight to the image service.
// The previous disk storage wrote to the OS temp directory, which is
// read-only on Vercel serverless instances and left temp files behind.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype?.toLowerCase())) {
      cb(new Error(`Unsupported file type "${file.mimetype}". Only JPG, PNG, WEBP, AVIF or GIF images are allowed.`));
      return;
    }
    cb(null, true);
  },
});

export default upload;
