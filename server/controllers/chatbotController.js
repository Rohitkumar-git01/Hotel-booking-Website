import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import Hotel from "../models/Hotel.js";
import User from "../models/User.js";

// Helper for calling Gemini API if GEMINI_API_KEY exists
const getGeminiResponse = async (userPrompt, systemContext) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `System Context:\n${systemContext}\n\nUser Message: ${userPrompt}\n\nInstructions: Respond helpfully, politely, and concisely as the AI Customer Support Agent for QuickStay Hotel Booking platform. Provide clear markdown formatting where appropriate.`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
  } catch (err) {
    console.error("Gemini API call error:", err);
  }
  return null;
};

export const handleChat = async (req, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.headers.userid || req.headers.clerkid;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "Message string is required" });
    }

    const cleanMsg = message.trim().toLowerCase();

    // 1. Load User context if authenticated
    let user = null;
    let userBookings = [];
    if (userId) {
      user = await User.findById(userId);
      userBookings = await Booking.find({ user: userId })
        .populate("room")
        .populate("hotel")
        .sort({ createdAt: -1 });
    }

    // 2. Load available rooms/hotels database context
    const availableRooms = await Room.find({ isAvailable: true }).populate("hotel").limit(10);
    const availableHotels = await Hotel.find().limit(10);

    // Build system context string for LLM or rule processing
    let systemContext = `Platform: QuickStay Hotel Booking Platform\n`;
    if (user) {
      systemContext += `Logged In User: ${user.username} (Email: ${user.email}, Role: ${user.role})\n`;
      systemContext += `User Bookings (${userBookings.length}):\n`;
      userBookings.forEach((b, idx) => {
        systemContext += `  ${idx + 1}. Booking ID: ${b._id}, Hotel: ${b.hotel?.name || "N/A"}, City: ${b.hotel?.city || "N/A"}, Room Type: ${b.room?.roomType || "N/A"}, Dates: ${new Date(b.checkInDate).toLocaleDateString()} to ${new Date(b.checkOutDate).toLocaleDateString()}, Status: ${b.status}, Paid: ${b.isPaid ? "Yes" : "No"}, Total Price: $${b.totalPrice}, Guests: ${b.guests}\n`;
      });
    } else {
      systemContext += `User: Guest (Not logged in)\n`;
    }

    systemContext += `Available Hotels & Cities in DB: ${[...new Set(availableHotels.map((h) => `${h.name} (${h.city})`))].join(", ")}\n`;
    systemContext += `Standard Policies: Free cancellation before 24 hrs of check-in. Check-in time: 2:00 PM, Check-out time: 11:00 AM. Payment methods: Stripe card online or Pay At Hotel.\n`;

    // Try Gemini API if key is present
    const geminiReply = await getGeminiResponse(message, systemContext);
    if (geminiReply) {
      // Determine suitable quick actions based on user message intent
      const actions = [];
      if (cleanMsg.includes("booking") || cleanMsg.includes("reservation")) {
        actions.push({ label: "My Bookings", action: "navigate", path: "/my-bookings" });
      }
      if (cleanMsg.includes("room") || cleanMsg.includes("hotel") || cleanMsg.includes("stay") || cleanMsg.includes("search")) {
        actions.push({ label: "Explore Rooms", action: "navigate", path: "/rooms" });
      }

      return res.status(200).json({
        success: true,
        reply: geminiReply,
        actions: actions.length > 0 ? actions : undefined,
      });
    }

    // Smart Rule Engine & Natural Language Assistant Response
    let reply = "";
    let actions = [];

    // --- Intent: Booking details / Status ---
    if (
      cleanMsg.includes("my booking") ||
      cleanMsg.includes("my reservation") ||
      cleanMsg.includes("active booking") ||
      cleanMsg.includes("booking status") ||
      cleanMsg.includes("show my booking") ||
      cleanMsg.includes("check booking") ||
      cleanMsg.includes("view booking")
    ) {
      if (!userId) {
        reply = "🔒 You are currently not signed in. Please sign in to view your personal hotel bookings and reservation details.";
        actions.push({ label: "Sign In Required", action: "login" });
      } else if (userBookings.length === 0) {
        reply = `Hello ${user?.username || "Guest"}! You don't have any bookings yet. Browse our top hotel rooms and make your first reservation today!`;
        actions.push({ label: "Browse Rooms", action: "navigate", path: "/rooms" });
      } else {
        const activeBookings = userBookings.filter((b) => b.status !== "cancelled");
        reply = `### 📋 Your Bookings Overview (${userBookings.length} total, ${activeBookings.length} active):\n\n`;

        userBookings.forEach((b, i) => {
          const statusEmoji = b.status === "confirmed" ? "✅" : b.status === "pending" ? "⏳" : "❌";
          const payEmoji = b.isPaid ? "💳 Paid" : "💵 Pay at Hotel";
          reply += `**${i + 1}. ${b.hotel?.name || "Hotel"}** (${b.hotel?.city || ""})\n`;
          reply += `• **Room Type:** ${b.room?.roomType || "Standard"}\n`;
          reply += `• **Dates:** ${new Date(b.checkInDate).toLocaleDateString()} ➔ ${new Date(b.checkOutDate).toLocaleDateString()}\n`;
          reply += `• **Guests:** ${b.guests} guest(s)\n`;
          reply += `• **Total:** $${b.totalPrice} (${payEmoji})\n`;
          reply += `• **Status:** ${statusEmoji} ${b.status.toUpperCase()}\n\n`;
        });

        reply += `You can manage or pay for your reservations on the **My Bookings** page.`;
        actions.push({ label: "Manage My Bookings", action: "navigate", path: "/my-bookings" });
      }
    }

    // --- Intent: Cancel Booking ---
    else if (cleanMsg.includes("cancel") || cleanMsg.includes("cancellation") || cleanMsg.includes("refund")) {
      if (!userId) {
        reply = "### ❌ Cancellation Policy\n\n• You can cancel bookings anytime before check-in.\n• Free cancellation applies up to 24 hours prior to check-in.\n\nPlease **Sign In** to view your active bookings and initiate cancellation.";
        actions.push({ label: "Sign In", action: "login" });
      } else if (userBookings.length === 0) {
        reply = "You have no active bookings to cancel right now. Free 24-hour cancellation is supported on all standard bookings!";
        actions.push({ label: "Explore Rooms", action: "navigate", path: "/rooms" });
      } else {
        const cancellable = userBookings.filter((b) => b.status !== "cancelled");
        reply = `### ❌ How to Cancel Your Booking\n\nYou have **${cancellable.length} active booking(s)** eligible for cancellation:\n\n`;
        cancellable.forEach((b) => {
          reply += `• **${b.hotel?.name}** (${b.room?.roomType}) for check-in on **${new Date(b.checkInDate).toLocaleDateString()}**\n`;
        });
        reply += `\nTo cancel any booking, go to **My Bookings** and click the **"Cancel"** button next to your reservation.`;
        actions.push({ label: "Go to My Bookings", action: "navigate", path: "/my-bookings" });
      }
    }

    // --- Intent: Check-in / Check-out time ---
    else if (cleanMsg.includes("check in") || cleanMsg.includes("check out") || cleanMsg.includes("check-in") || cleanMsg.includes("timing")) {
      reply = "### ⏰ Check-In & Check-Out Timings\n\n• **Standard Check-In:** 2:00 PM\n• **Standard Check-Out:** 11:00 AM\n\n*Note: Early check-in or late check-out can be requested directly by contacting your specific hotel.*";
      actions.push({ label: "View My Bookings", action: "navigate", path: "/my-bookings" });
    }

    // --- Intent: Room Search / Recommendation / Prices / Cities ---
    else if (
      cleanMsg.includes("room") ||
      cleanMsg.includes("hotel") ||
      cleanMsg.includes("available") ||
      cleanMsg.includes("search") ||
      cleanMsg.includes("recommend") ||
      cleanMsg.includes("price") ||
      cleanMsg.includes("cost") ||
      cleanMsg.includes("city") ||
      cleanMsg.includes("stay")
    ) {
      // Find matching city in available rooms/hotels
      const words = cleanMsg.split(/\s+/);
      let matchedCity = "";
      for (const h of availableHotels) {
        if (cleanMsg.includes(h.city.toLowerCase())) {
          matchedCity = h.city;
          break;
        }
      }

      let filtered = availableRooms;
      if (matchedCity) {
        filtered = availableRooms.filter((r) => r.hotel?.city?.toLowerCase() === matchedCity.toLowerCase());
      }

      if (filtered.length > 0) {
        reply = `### 🏨 ${matchedCity ? `Available Rooms in ${matchedCity}` : "Top Recommended Hotel Rooms"}:\n\n`;
        filtered.slice(0, 4).forEach((r) => {
          reply += `• **${r.hotel?.name || "Hotel"}** (${r.hotel?.city})\n`;
          reply += `  - **Type:** ${r.roomType}\n`;
          reply += `  - **Price:** $${r.pricePerNight} / night\n`;
          reply += `  - **Amenities:** ${r.amenities.slice(0, 3).join(", ")}\n\n`;
        });
        reply += `Click below to view all details, filter by date, or make a reservation!`;
        actions.push({
          label: matchedCity ? `View Rooms in ${matchedCity}` : "View All Rooms",
          action: "navigate",
          path: matchedCity ? `/rooms?city=${encodeURIComponent(matchedCity)}` : "/rooms",
        });
      } else {
        reply = `We found great stays across popular destinations like ${[...new Set(availableHotels.map((h) => h.city))].join(", ")}. Explore all options on our rooms directory!`;
        actions.push({ label: "Explore All Rooms", action: "navigate", path: "/rooms" });
      }
    }

    // --- Intent: Payment methods ---
    else if (cleanMsg.includes("pay") || cleanMsg.includes("payment") || cleanMsg.includes("stripe") || cleanMsg.includes("card") || cleanMsg.includes("cash")) {
      reply = "### 💳 Payment Methods Supported\n\nWe offer flexible options for your convenience:\n\n1. **Online Payment (Stripe)** - Instant confirmation with credit/debit card.\n2. **Pay At Hotel** - Pay directly at the front desk upon check-in.\n\nYou can select your preferred method during booking or pay online for pending reservations under **My Bookings**.";
      actions.push({ label: "View My Bookings", action: "navigate", path: "/my-bookings" });
    }

    // --- Intent: Hotel Owner / Partner / Register Hotel ---
    else if (
      cleanMsg.includes("register hotel") ||
      cleanMsg.includes("list hotel") ||
      cleanMsg.includes("owner") ||
      cleanMsg.includes("become owner") ||
      cleanMsg.includes("partner") ||
      cleanMsg.includes("dashboard")
    ) {
      reply = "### 🔑 List Your Hotel on QuickStay\n\nAre you a hotel owner? You can register your property with us and manage rooms, bookings, and revenue tracking effortlessly!\n\n1. Click **List Your Hotel** in the top navigation or footer.\n2. Fill in hotel name, address, contact, and city.\n3. Access your **Owner Dashboard** to add rooms and track bookings.";
      actions.push({ label: "Register Your Hotel", action: "open_hotel_reg" });
    }

    // --- Intent: Help / Hello / Default fallback ---
    else {
      const name = user?.username ? ` ${user.username}` : "";
      reply = `Hello${name}! 👋 I am your **QuickStay AI Assistant**. Here is what I can help you with:\n\n` +
        `• 📋 **Check your bookings** & reservation status\n` +
        `• ❌ **Help with cancellations** & payment questions\n` +
        `• 🏨 **Recommend & search rooms** by city or price\n` +
        `• 🔑 **Guide hotel owners** on listing properties\n\n` +
        `How can I assist you today?`;

      actions.push({ label: "My Bookings", action: "navigate", path: "/my-bookings" });
      actions.push({ label: "Browse Rooms", action: "navigate", path: "/rooms" });
    }

    return res.status(200).json({
      success: true,
      reply,
      actions,
    });
  } catch (error) {
    console.error("Chatbot Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "AI Chatbot service temporary error",
      error: error.message,
    });
  }
};
