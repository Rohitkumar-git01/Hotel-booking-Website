import mongoose from "mongoose";
import User from "../models/User.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";

const seedDB = async () => {
  try {
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
            "/src/assets/roomImg1.png",
            "/src/assets/roomImg2.png",
            "/src/assets/roomImg3.png",
            "/src/assets/roomImg4.png",
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
            "/src/assets/roomImg2.png",
            "/src/assets/roomImg3.png",
            "/src/assets/roomImg4.png",
            "/src/assets/roomImg1.png",
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
            "/src/assets/roomImg3.png",
            "/src/assets/roomImg4.png",
            "/src/assets/roomImg1.png",
            "/src/assets/roomImg2.png",
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
            "/src/assets/roomImg4.png",
            "/src/assets/roomImg1.png",
            "/src/assets/roomImg2.png",
            "/src/assets/roomImg3.png",
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

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () => {
      console.log("Database Connected");
      seedDB();
    });
    await mongoose.connect(`${process.env.MONGODB_URI}/hotel-booking`);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

export default connectDB;
