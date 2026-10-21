import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./configs/db.js";
import userRouter from "./routes/userRoutes.js";
import hotelRouter from "./routes/hotelRoutes.js";
import roomRouter from "./routes/roomRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import chatbotRouter from "./routes/chatbotRoutes.js";
import { clerkWebhooks } from "./controllers/clerkWebhooks.js";

const app = express();

// Connect to MongoDB
connectDB();

// Global Middlewares
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "userid"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure DB connection in serverless / cold start environments
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// API Routes
app.use("/api/users", userRouter);
app.use("/api/hotels", hotelRouter);
app.use("/api/rooms", roomRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/chatbot", chatbotRouter);

// Clerk Webhooks Endpoint
app.post("/api/webhooks/clerk", clerkWebhooks);

// Health Check Endpoint
app.get("/", (req, res) => {
  res.send("API is working!");
});

const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;