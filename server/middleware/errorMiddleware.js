import mongoose from "mongoose";
import { HttpError } from "../utils/httpError.js";

// 404 handler for unmatched API routes.
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Centralised error handler. Every controller error ends up here so the API
// always answers with the same JSON envelope: { success, message, ... }.
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Mongoose: bad ObjectId / malformed document
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      message: `Invalid value for "${err.path}".`,
    });
  }

  // Mongoose: schema validation failed
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([key, value]) => [key, value.message])
    );
    return res.status(400).json({
      success: false,
      message: "Validation failed. Please check the highlighted fields.",
      details,
    });
  }

  // Multer: file too large / unsupported type
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "Each image must be 5 MB or smaller.",
    });
  }
  if (err?.code === "LIMIT_FILE_COUNT" || err?.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      message: "Too many files uploaded.",
    });
  }
  if (err?.name === "MulterError") {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Duplicate key — most importantly the booking inventory lock.
  if (err?.code === 11000) {
    const isInventoryLock =
      JSON.stringify(err.keyPattern || err.keyValue || {}).includes("date") ||
      JSON.stringify(err.keyValue || {}).includes("date");
    return res.status(409).json({
      success: false,
      message: isInventoryLock
        ? "This room was just booked for the selected dates. Please choose different dates."
        : "A record with these details already exists.",
      details: err.keyValue,
    });
  }

  const status = err instanceof HttpError ? err.status : err.status || 500;

  if (status >= 500) {
    console.error("Unhandled API error:", err);
  }

  return res.status(status).json({
    success: false,
    message: status >= 500 ? "Something went wrong on our side. Please try again." : err.message,
    ...(err instanceof HttpError && err.details ? { details: err.details } : {}),
    ...(process.env.NODE_ENV !== "production" && status >= 500 ? { error: err.message } : {}),
  });
};
