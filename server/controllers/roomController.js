import { v2 as cloudinary } from "cloudinary";
import Room from "../models/Room.js";
import Hotel from "../models/Hotel.js";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Add Room (Hotel Owners only)
export const addRoom = async (req, res) => {
  try {
    const { roomType, pricePerNight, amenities } = req.body;

    if (!roomType || !pricePerNight) {
      return res.status(400).json({ success: false, message: "Room type and price per night are required" });
    }

    // Find the hotel owned by this user
    const hotel = await Hotel.findOne({ owner: req.userId });
    if (!hotel) {
      return res.status(404).json({ success: false, message: "You need to register a hotel before adding rooms" });
    }

    // Handle amenities (client might send as array or stringified JSON or comma-separated string)
    let processedAmenities = [];
    if (amenities) {
      try {
        processedAmenities = typeof amenities === "string" ? JSON.parse(amenities) : amenities;
      } catch (e) {
        processedAmenities = typeof amenities === "string" ? amenities.split(",") : [];
      }
    }

    // If amenities was an object like { "free WiFi": true, ... }, convert keys with true value to list
    if (!Array.isArray(processedAmenities) && typeof processedAmenities === "object") {
      processedAmenities = Object.keys(processedAmenities).filter((key) => processedAmenities[key]);
    }

    // Handle image uploads
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: "hotel_rooms",
        });
        imageUrls.push(uploadResult.secure_url);
      }
    }

    const newRoom = await Room.create({
      hotel: hotel._id,
      roomType,
      pricePerNight: Number(pricePerNight),
      amenities: processedAmenities,
      images: imageUrls,
      isAvailable: true,
    });

    return res.status(201).json({ success: true, message: "Room added successfully", room: newRoom });
  } catch (error) {
    console.error("Add Room Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Rooms with filters (roomType, priceRange, sorting)
export const getRooms = async (req, res) => {
  try {
    const { roomTypes, priceRanges, sort, city } = req.query;

    const query = { isAvailable: true };

    // 1. Filter by City
    if (city) {
      const hotels = await Hotel.find({ city: new RegExp(city, "i") });
      const hotelIds = hotels.map((h) => h._id);
      query.hotel = { $in: hotelIds };
    }

    // 2. Filter by Room Types
    if (roomTypes) {
      const typesArray = roomTypes.split(",");
      query.roomType = { $in: typesArray };
    }

    // 2. Filter by Price Ranges
    if (priceRanges) {
      const rangesArray = priceRanges.split(",");
      const priceQueryConditions = [];

      rangesArray.forEach((range) => {
        // Example ranges: "0 to 100", "500 to 1000", "1000 to 2000", "2000 and above"
        const cleanRange = range.replace(/\$/g, "").trim().toLowerCase();
        if (cleanRange.includes("and above")) {
          const minVal = parseInt(cleanRange.split(" ")[0]);
          priceQueryConditions.push({ pricePerNight: { $gte: minVal } });
        } else if (cleanRange.includes("to")) {
          const parts = cleanRange.split("to");
          const min = parseInt(parts[0].trim());
          const max = parseInt(parts[1].trim());
          priceQueryConditions.push({ pricePerNight: { $gte: min, $lte: max } });
        }
      });

      if (priceQueryConditions.length > 0) {
        query.$or = priceQueryConditions;
      }
    }

    let sortOption = {};
    // 3. Sorting Options
    if (sort) {
      // Examples: "Price: Low to High", "Price: High to Low"
      if (sort === "Price: Low to High") {
        sortOption.pricePerNight = 1;
      } else if (sort === "Price: High to Low") {
        sortOption.pricePerNight = -1;
      } else {
        // Default sort by creation time
        sortOption.createdAt = -1;
      }
    } else {
      sortOption.createdAt = -1;
    }

    const rooms = await Room.find(query)
      .populate("hotel")
      .sort(sortOption);

    return res.status(200).json({ success: true, rooms });
  } catch (error) {
    console.error("Get Rooms Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Room Details by ID
export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id).populate({
      path: "hotel",
      populate: {
        path: "owner",
        select: "-email", // protect email but send role/username/image
      },
    });

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    return res.status(200).json({ success: true, room });
  } catch (error) {
    console.error("Get Room By ID Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get hotel owner's rooms
export const getMyRooms = async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ owner: req.userId });
    if (!hotel) {
      return res.status(404).json({ success: false, message: "No hotel registered for this account" });
    }

    const rooms = await Room.find({ hotel: hotel._id });
    return res.status(200).json({ success: true, rooms });
  } catch (error) {
    console.error("Get My Rooms Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle Room Availability (Hotel Owners only)
export const toggleAvailability = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId).populate("hotel");
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Verify ownership
    if (room.hotel.owner.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "You are not authorized to manage this room" });
    }

    room.isAvailable = !room.isAvailable;
    await room.save();

    return res.status(200).json({
      success: true,
      message: `Room status updated to ${room.isAvailable ? "Available" : "Unavailable"}`,
      room,
    });
  } catch (error) {
    console.error("Toggle Availability Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
