import User from "../models/User.js";

// Users listed in `ADMIN_USER_IDS` (comma separated Clerk user ids) are
// promoted to the admin role when they sync their profile. This is the
// bootstrap path for the very first admin account - no manual database edit
// is required.
const getAdminUserIds = () =>
  (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const isAdminUser = (clerkId) => getAdminUserIds().includes(clerkId);

// Fetch User Profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Get User Profile Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Sync Clerk User on Client Login (fallback helper for local environments without webhooks)
// The identity comes from the verified Clerk session token (req.userId), never
// from the request body -- otherwise anyone could overwrite another user's record.
export const syncUser = async (req, res) => {
  try {
    const { username, email, image } = req.body;
    const clerkId = req.userId;

    if (!clerkId) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: "email is required" });
    }

    let user = await User.findById(clerkId);
    if (!user) {
      user = await User.create({
        _id: clerkId,
        username: username || "Guest User",
        email,
        image: image || "",
        role: isAdminUser(clerkId) ? "admin" : "user",
      });
      return res.status(201).json({ success: true, user, message: "User created via sync" });
    } else {
      user.username = username || user.username;
      user.image = image || user.image;
      // Admin promotion happens on every sync so adding an id to
      // ADMIN_USER_IDS takes effect without touching the database.
      if (isAdminUser(clerkId) && user.role !== "admin") {
        user.role = "admin";
      }
      await user.save();
      return res.status(200).json({ success: true, user, message: "User synced successfully" });
    }
  } catch (error) {
    console.error("Sync User Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
