import { v2 as cloudinary } from "cloudinary";

// ---------------------------------------------------------------------------
// Cloudinary helper.
//
// The credentials stay on the server. The frontend only ever receives the
// resulting public URLs.
//
// Uploads use `upload_stream` with an in-memory buffer instead of a temp file
// path, because Vercel serverless functions have a read-only file system.
// ---------------------------------------------------------------------------

let configured = false;

const configure = () => {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
};

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

/**
 * Uploads one image buffer and returns { url, publicId }.
 */
export const uploadImageBuffer = (buffer, { folder = "quickstay", filename } = {}) =>
  new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      reject(new Error("Image uploads are not configured on the server."));
      return;
    }

    configure();

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        overwrite: false,
        ...(filename ? { public_id: filename } : {}),
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Image upload failed."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });

/**
 * Uploads many image buffers. Individual failures are reported but do not
 * abort the whole batch, so one corrupt file cannot lose the other photos.
 */
export const uploadImageBuffers = async (files = [], { folder = "quickstay" } = {}) => {
  const uploaded = [];
  const failures = [];

  for (const [index, file] of files.entries()) {
    try {
      const { url, publicId } = await uploadImageBuffer(file.buffer, {
        folder,
        filename: `${folder}_${Date.now()}_${index}`,
      });
      uploaded.push({ url, publicId });
    } catch (error) {
      failures.push({ name: file.originalname, message: error.message });
    }
  }

  return { uploaded, failures };
};

/**
 * Derives the Cloudinary public id from a secure URL so an image can be
 * removed from the provider when the owner deletes it.
 */
export const publicIdFromUrl = (url) => {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return null;
  }
  const afterUpload = url.split("/upload/")[1];
  if (!afterUpload) return null;
  const withoutQuery = afterUpload.split("?")[0];
  const segments = withoutQuery.split("/");
  // The first segment is the transformation/version hash when present.
  const withoutVersion = segments[0].startsWith("v") && /^v\d+$/.test(segments[0])
    ? segments.slice(1)
    : segments;
  const joined = withoutVersion.join("/");
  return joined.replace(/\.[a-z0-9]+$/i, "") || null;
};

/**
 * Removes an image from Cloudinary. Missing credentials or an unknown image
 * are ignored — deleting a listing must not fail because the CDN is down.
 */
export const destroyImage = async (url) => {
  const publicId = publicIdFromUrl(url);
  if (!publicId || !isCloudinaryConfigured()) return false;
  try {
    configure();
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.warn("Could not delete image from Cloudinary:", error.message);
    return false;
  }
};
