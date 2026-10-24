import express from "express";
import { getUserProfile, syncUser } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const userRouter = express.Router();

userRouter.post("/sync", protect, syncUser);
userRouter.get("/profile", protect, getUserProfile);

export default userRouter;
