import User from "../models/User.js";

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
export const syncUser = async (req, res) => {
  try {
    const { clerkId, username, email, image } = req.body;

    if (!clerkId || !email) {
      return res.status(400).json({ success: false, message: "clerkId and email are required" });
    }

    let user = await User.findById(clerkId);
    if (!user) {
      user = await User.create({
        _id: clerkId,
        username: username || "Guest User",
        email,
        image: image || "",
        role: "user",
      });
      return res.status(201).json({ success: true, user, message: "User created via sync" });
    } else {
      user.username = username || user.username;
      user.image = image || user.image;
      await user.save();
      return res.status(200).json({ success: true, user, message: "User synced successfully" });
    }
  } catch (error) {
    console.error("Sync User Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
