import express from "express";
import {
  createBooking,
  getUserBookings,
  cancelBooking,
  payBooking,
  getOwnerDashboard,
} from "../controllers/bookingController.js";
import { protect, isOwner } from "../middleware/authMiddleware.js";

const bookingRouter = express.Router();

bookingRouter.post("/create", protect, createBooking);
bookingRouter.get("/my-bookings", protect, getUserBookings);
bookingRouter.patch("/cancel/:bookingId", protect, cancelBooking);
bookingRouter.patch("/pay/:bookingId", protect, payBooking);
bookingRouter.get("/dashboard", protect, isOwner, getOwnerDashboard);

export default bookingRouter;
