import express from "express";
import {
  createBooking,
  getUserBookings,
  cancelBooking,
  payBooking,
  getOwnerDashboard,
  getRoomAvailability,
  getBookingById,
} from "../controllers/bookingController.js";
import { protect, isOwner } from "../middleware/authMiddleware.js";

const bookingRouter = express.Router();

bookingRouter.post("/create", protect, createBooking);
bookingRouter.get("/my-bookings", protect, getUserBookings);
bookingRouter.get("/room/:roomId", getRoomAvailability);
bookingRouter.get("/dashboard", protect, isOwner, getOwnerDashboard);
bookingRouter.patch("/cancel/:bookingId", protect, cancelBooking);
bookingRouter.patch("/pay/:bookingId", protect, payBooking);
bookingRouter.get("/:bookingId", protect, getBookingById);

export default bookingRouter;
