import mongoose from "mongoose";
import User from "../models/User.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";

// Public Unsplash hotel images to use in place of broken local paths
const PUBLIC_ROOM_IMAGES = [
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
  "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
];

// Fix any rooms that were seeded with local /src/assets/ paths
const fixBrokenImages = async () => {
  try {
    const roomsWithBrokenImages = await Room.find({
      images: { $elemMatch: { $regex: "^/src/assets/" } },
    });

    if (roomsWithBrokenImages.length > 0) {
      console.log(`Fixing broken images in ${roomsWithBrokenImages.length} room(s)...`);
      for (const room of roomsWithBrokenImages) {
        room.images = PUBLIC_ROOM_IMAGES;
        await room.save();
      }
      console.log("Broken images fixed successfully.");
    }
  } catch (err) {
    console.error("fixBrokenImages error:", err.message);
  }
};

const seedDB = async () => {
  try {
    // Always fix broken images on startup
    await fixBrokenImages();

    const roomCount = await Room.countDocuments();
    if (roomCount === 0) {
      console.log("Database is empty. Seeding default data...");

      // 1. Seed user if not exists
      const userId = "user_2unqyL4diJFP1E3pIBnasc7w8hP";
      let user = await User.findById(userId);
      if (!user) {
        user = await User.create({
          _id: userId,
          username: "Great Stack",
          email: "user.greatstack@gmail.com",
          image: "https://img.clerk.com/eyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL2ltYWdlcy5jbGVyay5kZXYvdXBsb2FkZWQvaW1nXzJ2N2c5YVpSSEFVYVUxbmVYZ2JkSVVuWnFzWSJ9",
          role: "hotelOwner",
        });
        console.log("Seed user created");
      }

      // 2. Seed hotel if not exists
      const hotelId = "67f76393197ac559e4089b72";
      let hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        hotel = await Hotel.create({
          _id: hotelId,
          name: "Urbanza Suites",
          address: "Main Road  123 Street , 23 Colony",
          contact: "+0123456789",
          owner: userId,
          city: "New York",
        });
        console.log("Seed hotel created");
      }

      // 3. Seed rooms
      const roomsToSeed = [
        {
          _id: "67f7647c197ac559e4089b96",
          hotel: hotelId,
          roomType: "Double Bed",
          pricePerNight: 399,
          amenities: ["Room Service", "Mountain View", "Pool Access"],
          images: [
            "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
            "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
            "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
          ],
          isAvailable: true,
        },
        {
          _id: "67f76452197ac559e4089b8e",
          hotel: hotelId,
          roomType: "Double Bed",
          pricePerNight: 299,
          amenities: ["Room Service", "Mountain View", "Pool Access"],
          images: [
            "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
            "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
            "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
            "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
          ],
          isAvailable: true,
        },
        {
          _id: "67f76406197ac559e4089b82",
          hotel: hotelId,
          roomType: "Double Bed",
          pricePerNight: 249,
          amenities: ["Free WiFi", "Free Breakfast", "Room Service"],
          images: [
            "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
            "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
            "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
          ],
          isAvailable: true,
        },
        {
          _id: "67f763d8197ac559e4089b7a",
          hotel: hotelId,
          roomType: "Single Bed",
          pricePerNight: 199,
          amenities: ["Free WiFi", "Room Service", "Pool Access"],
          images: [
            "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
            "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800",
            "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
          ],
          isAvailable: true,
        },
      ];

      await Room.insertMany(roomsToSeed);
      console.log("Database seeded with default rooms successfully!");
    }
  } catch (error) {
    console.error("Seeding database failed:", error);
  }
};

let isSeeded = false;
let isListenersAttached = false;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    if (!isListenersAttached) {
      isListenersAttached = true;
      mongoose.connection.on("connected", () => {
        console.log(`Database Connected successfully to: ${mongoose.connection.name}`);
        if (!isSeeded) {
          isSeeded = true;
          seedDB();
        }
      });

      mongoose.connection.on("error", (err) => {
        console.error("Database connection error:", err.message);
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("Database disconnected");
      });
    }

    const uri = process.env.MONGODB_URI?.trim() || "mongodb://127.0.0.1:27017/hotel-booking";

    await mongoose.connect(uri, {
      dbName: "hotel-booking",
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
};

export default connectDB;
