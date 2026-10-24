import express from "express";
import {
  addRoom,
  updateRoom,
  deleteRoom,
  getRooms,
  getRoomById,
  getMyRooms,
  getHotelRooms,
  getHotelRoomTypes,
  checkRoomAvailability,
  toggleAvailability,
} from "../controllers/roomController.js";
import { protect, optionalAuth, isOwner } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const roomRouter = express.Router();

const imageUpload = upload.array("images", 6);

// Creation (owner of the hotel, or an admin).
roomRouter.post("/add", protect, isOwner, imageUpload, addRoom);
roomRouter.post("/", protect, isOwner, imageUpload, addRoom);

// Reads.
roomRouter.get("/list", getRooms);
roomRouter.get("/my-rooms", protect, isOwner, getMyRooms);
roomRouter.get("/hotel/:hotelId", optionalAuth, getHotelRooms);
roomRouter.get("/hotel/:hotelId/types", optionalAuth, getHotelRoomTypes);
roomRouter.get("/availability/:roomId", checkRoomAvailability);

// Management.
roomRouter.patch("/toggle/:roomId", protect, isOwner, toggleAvailability);
roomRouter.patch("/:id", protect, isOwner, updateRoom);
roomRouter.delete("/:id", protect, isOwner, deleteRoom);

// Public room details.
roomRouter.get("/:id", optionalAuth, getRoomById);

export default roomRouter;
