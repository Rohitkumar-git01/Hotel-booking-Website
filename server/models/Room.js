import mongoose from "mongoose";
import { ROOM_TYPES } from "../utils/constants.js";

// The existing schema models an individual bookable unit: every Room document
// is one sellable room of a given `roomType` inside a hotel. Several documents
// sharing the same `roomType` therefore act as the inventory for that room
// type. That design is preserved here — rooms are never collapsed into a
// single "type" document, so existing bookings keep pointing at a real room.
const roomSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
    roomType: {
      type: String,
      required: true,
      enum: ROOM_TYPES,
    },
    pricePerNight: { type: Number, required: true, min: 0 },
    // Maximum number of guests this room can host.
    capacity: { type: Number, default: 2, min: 1, max: 20 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    amenities: [{ type: String }],
    images: [{ type: String }],
    // Cloudinary public ids for the entries in `images`.
    imageIds: { type: [String], default: [] },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.index({ hotel: 1, roomType: 1 });
roomSchema.index({ hotel: 1, pricePerNight: 1 });

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);

export default Room;
