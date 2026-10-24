import mongoose from "mongoose";
import User from "../models/User.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";

// Public Unsplash hotel images, grouped into distinct sets so no two rooms end
// up with the same cover photo.
const ROOM_IMAGE_SETS = [
  [
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
    "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
  ],
  [
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800",
    "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
  ],
  [
    "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800",
    "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800",
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
  ],
  [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800",
  ],
];

// Fix any rooms that were seeded with local /src/assets/ paths, giving each
// room its own image set instead of repeating one across every card.
const fixBrokenImages = async () => {
  try {
    const roomsWithBrokenImages = await Room.find({
      images: { $elemMatch: { $regex: "^/src/assets/" } },
    });

    if (roomsWithBrokenImages.length > 0) {
      console.log(`Fixing broken images in ${roomsWithBrokenImages.length} room(s)...`);
      for (const [index, room] of roomsWithBrokenImages.entries()) {
        room.images = ROOM_IMAGE_SETS[index % ROOM_IMAGE_SETS.length];
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
          description:
            "A premium city hotel in the heart of New York with comfortable rooms, free breakfast and round-the-clock front desk service.",
          category: "Hotel",
          state: "New York",
          country: "United States",
          postalCode: "10001",
          latitude: 40.7128,
          longitude: -74.006,
          contactEmail: "stay@urbanzasuites.com",
          amenities: ["Free WiFi", "Free Breakfast", "Room Service", "Gym", "24/7 Front Desk"],
          checkInTime: "2:00 PM",
          checkOutTime: "11:00 AM",
          // The demo listing predates the approval workflow, so it is
          // explicitly approved to stay publicly visible.
          approvalStatus: "approved",
          approvedAt: new Date(),
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
          capacity: 2,
          description: "Spacious double room with a city view and a work desk.",
          amenities: ["Room Service", "Mountain View", "Pool Access"],
          images: ROOM_IMAGE_SETS[0],
          isAvailable: true,
        },
        {
          _id: "67f76452197ac559e4089b8e",
          hotel: hotelId,
          roomType: "Double Bed",
          pricePerNight: 299,
          capacity: 2,
          description: "Comfortable double room with free breakfast included.",
          amenities: ["Room Service", "Mountain View", "Pool Access"],
          images: ROOM_IMAGE_SETS[1],
          isAvailable: true,
        },
        {
          _id: "67f76406197ac559e4089b82",
          hotel: hotelId,
          roomType: "Double Bed",
          pricePerNight: 249,
          capacity: 2,
          description: "Cosy double room close to the lobby and the breakfast area.",
          amenities: ["Free WiFi", "Free Breakfast", "Room Service"],
          images: ROOM_IMAGE_SETS[2],
          isAvailable: true,
        },
        {
          _id: "67f763d8197ac559e4089b7a",
          hotel: hotelId,
          roomType: "Single Bed",
          pricePerNight: 199,
          capacity: 1,
          description: "Compact single room, ideal for solo travellers.",
          amenities: ["Free WiFi", "Room Service", "Pool Access"],
          images: ROOM_IMAGE_SETS[3],
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
        if (!isSeeded && process.env.SKIP_SEED !== "1") {
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

    // The database name is pinned so that a connection string without a path
    // (the usual Atlas format) still uses the right database. `MONGODB_DB_NAME`
    // allows the test suite to point at a throw-away database without
    // touching the real one.
    const dbName = process.env.MONGODB_DB_NAME?.trim() || "hotel-booking";

    await mongoose.connect(uri, {
      dbName,
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
};

export default connectDB;
