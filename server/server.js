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
import { notFoundHandler, errorHandler } from "./middleware/errorMiddleware.js";

const app = express();

// Connect to MongoDB
connectDB();

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// `CLIENT_URL` holds the comma separated list of frontend origins that may
// call the API (e.g. "https://quickstay.vercel.app,http://localhost:5173").
// When it is not set the API stays open, which keeps local development
// friction free. Production deployments should always set it.
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins.length
    ? (origin, callback) => {
        // Same-origin/server-to-server calls have no Origin header.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    : "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

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

// Unknown API route + centralised error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
