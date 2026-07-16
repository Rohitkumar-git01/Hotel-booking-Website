import express from "express";
import { registerHotel, getMyHotel } from "../controllers/hotelController.js";
import { protect } from "../middleware/authMiddleware.js";

const hotelRouter = express.Router();

hotelRouter.post("/register", protect, registerHotel);
hotelRouter.get("/my-hotel", protect, getMyHotel);

export default hotelRouter;
