import Hotel from "../models/Hotel.js";
import User from "../models/User.js";

// Register Hotel
export const registerHotel = async (req, res) => {
  try {
    const { name, contact, address, city } = req.body;

    if (!name || !contact || !address || !city) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Check if user already owns a hotel
    const existingHotel = await Hotel.findOne({ owner: req.userId });
    if (existingHotel) {
      return res.status(400).json({
        success: false,
        message: "You have already registered a hotel.",
        hotel: existingHotel,
      });
    }

    const hotel = await Hotel.create({
      name,
      contact,
      address,
      city,
      owner: req.userId,
    });

    // Upgrade user's role to hotelOwner
    await User.findByIdAndUpdate(req.userId, { role: "hotelOwner" });

    return res.status(201).json({
      success: true,
      message: "Hotel registered successfully",
      hotel,
    });
  } catch (error) {
    console.error("Register Hotel Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get current user's registered hotel details
export const getMyHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ owner: req.userId });
    if (!hotel) {
      return res.status(404).json({ success: false, message: "No hotel registered for this user" });
    }
    return res.status(200).json({ success: true, hotel });
  } catch (error) {
    console.error("Get My Hotel Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
