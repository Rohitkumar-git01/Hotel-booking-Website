import { Webhook } from "svix";
import User from "../models/User.js";

// Webhook handler for Clerk events
export const clerkWebhooks = async (req, res) => {
  try {
    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    
    // Verify Webhook signature
    const payload = req.body;
    const headers = {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    };

    whook.verify(JSON.stringify(payload), headers);

    const { data, type } = payload;

    switch (type) {
      case "user.created": {
        const username = `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.username || "Guest User";
        const email = data.email_addresses[0]?.email_address;
        const image = data.image_url;
        
        await User.create({
          _id: data.id,
          username,
          email,
          image,
          role: "user",
        });
        return res.status(201).json({ success: true, message: "User created via Webhook" });
      }
      case "user.updated": {
        const username = `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.username || "Guest User";
        const email = data.email_addresses[0]?.email_address;
        const image = data.image_url;

        await User.findByIdAndUpdate(data.id, {
          username,
          email,
          image,
        });
        return res.status(200).json({ success: true, message: "User updated via Webhook" });
      }
      case "user.deleted": {
        await User.findByIdAndDelete(data.id);
        return res.status(200).json({ success: true, message: "User deleted via Webhook" });
      }
      default:
        return res.status(200).json({ success: true, message: "Webhook event type ignored" });
    }
  } catch (error) {
    console.error("Clerk Webhook Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};
