import express from "express";
import {
  createHotel,
  registerHotel,
  getHotels,
  getHotelById,
  getMyHotels,
  getMyHotel,
  updateHotel,
  deleteHotel,
  getAdminHotels,
  approveHotel,
  rejectHotel,
  uploadHotelImages,
  removeHotelImage,
  geocode,
  reverseGeocodeHandler,
} from "../controllers/hotelController.js";
import { protect, optionalAuth, isAdmin } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimitMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const hotelRouter = express.Router();

// ---------------------------------------------------------------------------
// Geocoding proxy.
// Public, but rate limited to stay within the Nominatim usage policy
// (max 1 request per second). The frontend never talks to the provider
// directly, so no provider configuration ends up in the client bundle.
// ---------------------------------------------------------------------------
const geocodeLimiter = rateLimit({ windowMs: 1000, max: 2, keyPrefix: "geocode" });
hotelRouter.get("/geocode", geocodeLimiter, geocode);
hotelRouter.get("/reverse-geocode", geocodeLimiter, reverseGeocodeHandler);

// ---------------------------------------------------------------------------
// Owner endpoints
// ---------------------------------------------------------------------------
hotelRouter.get("/my-hotels", protect, getMyHotels);
hotelRouter.get("/my-hotel", protect, getMyHotel);

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------
hotelRouter.get("/admin/all", protect, isAdmin, getAdminHotels);
hotelRouter.patch("/:id/approve", protect, isAdmin, approveHotel);
hotelRouter.patch("/:id/reject", protect, isAdmin, rejectHotel);

// ---------------------------------------------------------------------------
// Listing management
// ---------------------------------------------------------------------------
hotelRouter.post("/register", protect, registerHotel);
hotelRouter.post("/", protect, createHotel);
hotelRouter.patch("/:id", protect, updateHotel);
hotelRouter.delete("/:id", protect, deleteHotel);
hotelRouter.post("/:id/images", protect, upload.array("images", 10), uploadHotelImages);
hotelRouter.delete("/:id/images/:index", protect, removeHotelImage);

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------
hotelRouter.get("/", getHotels);
// `optionalAuth` lets the owner of a pending listing preview it while
// everybody else gets a 404.
hotelRouter.get("/:id", optionalAuth, getHotelById);

export default hotelRouter;
