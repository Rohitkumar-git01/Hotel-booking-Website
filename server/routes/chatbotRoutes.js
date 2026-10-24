import express from "express";
import { handleChat } from "../controllers/chatbotController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const chatbotRouter = express.Router();

// optionalAuth attaches the user only when a valid Clerk token is supplied.
// Guests can still chat; they just don't get personal booking data.
chatbotRouter.post("/chat", optionalAuth, handleChat);

export default chatbotRouter;
