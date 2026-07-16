import User from "../models/User.js";

// Middleware to authenticate user using Clerk ID passed in headers
export const protect = async (req, res, next) => {
  try {
    const userId = req.headers.userid || req.headers.clerkid;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authorized, no user ID provided" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found in database" });
    }

    req.userId = userId;
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ success: false, message: "Server auth error", error: error.message });
  }
};

// Middleware to authorize hotel owner routes
export const isOwner = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "hotelOwner") {
      return res.status(403).json({ success: false, message: "Access denied. Only hotel owners are allowed" });
    }
    next();
  } catch (error) {
    console.error("Owner Authorization Error:", error);
    res.status(500).json({ success: false, message: "Server authorization error" });
  }
};
