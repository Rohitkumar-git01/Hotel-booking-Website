import mongoose from "mongoose";
import { HOTEL_CATEGORIES, APPROVAL_STATUSES } from "../utils/constants.js";

// GeoJSON point sub-document. `coordinates` is stored in GeoJSON order:
// [longitude, latitude].
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number] }, // [lng, lat]
  },
  { _id: false }
);

const hotelSchema = new mongoose.Schema(
  {
    // ---- Identity -------------------------------------------------------
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    category: {
      type: String,
      enum: HOTEL_CATEGORIES,
      default: "Hotel",
    },

    // ---- Location -------------------------------------------------------
    address: { type: String, required: true, trim: true, maxlength: 400 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    state: { type: String, default: "", trim: true, maxlength: 120 },
    country: { type: String, default: "", trim: true, maxlength: 120 },
    postalCode: { type: String, default: "", trim: true, maxlength: 20 },

    // Scalar coordinates are the source of truth used by the UI. `location`
    // mirrors them as a GeoJSON point so `$geo` queries and standard map
    // tooling can consume them. GeoJSON order is [longitude, latitude].
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    location: { type: pointSchema, default: undefined, required: false },

    // ---- Contact --------------------------------------------------------
    // `contact` is the original required phone field and is kept as-is so the
    // existing records and the legacy registration endpoint stay valid.
    contact: { type: String, required: true, trim: true, maxlength: 40 },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    // ---- Facilities -----------------------------------------------------
    amenities: { type: [String], default: [] },
    checkInTime: { type: String, default: "2:00 PM", trim: true, maxlength: 20 },
    checkOutTime: { type: String, default: "11:00 AM", trim: true, maxlength: 20 },

    // ---- Media ----------------------------------------------------------
    images: { type: [String], default: [] },
    // Cloudinary public ids for the entries in `images`, so an owner can
    // remove a photo from the CDN as well as from the database.
    imageIds: { type: [String], default: [] },

    // ---- Ownership & moderation ----------------------------------------
    owner: { type: String, ref: "User", required: true },
    // NOTE: no schema default on purpose. Documents created before the
    // approval workflow existed have no `approvalStatus` and are treated as
    // approved by the public queries (see `approvedHotelFilter`). A default of
    // "pending" would silently un-publish those legacy hotels the first time
    // they were saved.
    approvalStatus: { type: String, enum: APPROVAL_STATUSES },
    rejectionReason: { type: String, default: "", trim: true, maxlength: 1000 },
    approvedBy: { type: String, ref: "User", default: null },
    approvedAt: { type: Date, default: null },

    // ---- Presentation ---------------------------------------------------
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Query helpers used by the public listing endpoints.
hotelSchema.index({ owner: 1 });
hotelSchema.index({ city: 1 });
hotelSchema.index({ approvalStatus: 1, createdAt: -1 });
hotelSchema.index({ location: "2dsphere" });
hotelSchema.index({ name: "text", city: "text", address: "text" });

/**
 * Keeps `location` in sync with the scalar latitude/longitude pair.
 * Runs on save and on validated updates.
 */
function syncLocation() {
  const lat = this.latitude;
  const lng = this.longitude;
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  if (hasCoords) {
    this.location = { type: "Point", coordinates: [lng, lat] };
  } else {
    this.location = undefined;
  }
}

hotelSchema.pre("save", syncLocation);
hotelSchema.pre("findOneAndUpdate", function syncLocationOnUpdate(next) {
  syncLocation.call(this);
  next();
});

/**
 * Hotels that customers are allowed to see.
 *
 * Legacy documents (created before the approval workflow) have no
 * `approvalStatus` at all. They were publicly listed before, so they are
 * included here; the migration script (`npm run migrate`) backfills them with
 * an explicit "approved" value so this clause eventually becomes a no-op.
 */
export const approvedHotelFilter = () => ({
  $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
});

const Hotel = mongoose.models.Hotel || mongoose.model("Hotel", hotelSchema);

export default Hotel;
