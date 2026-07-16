import express from "express";
import { addRoom, getRooms, getRoomById, getMyRooms, toggleAvailability } from "../controllers/roomController.js";
import { protect, isOwner } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const roomRouter = express.Router();

roomRouter.post("/add", protect, isOwner, upload.array("images", 4), addRoom);
roomRouter.get("/list", getRooms);
roomRouter.get("/my-rooms", protect, isOwner, getMyRooms);
roomRouter.get("/:id", getRoomById);
roomRouter.patch("/toggle/:roomId", protect, isOwner, toggleAvailability);

export default roomRouter;
