import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import Hotel from "../models/Hotel.js";

// Create a Room Booking
export const createBooking = async (req, res) => {
  try {
    const { roomId, checkInDate, checkOutDate, guests, paymentMethod } = req.body;

    if (!roomId || !checkInDate || !checkOutDate || !guests) {
      return res.status(400).json({ success: false, message: "Missing required booking details" });
    }

    const room = await Room.findById(roomId).populate("hotel");
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    if (!room.isAvailable) {
      return res.status(400).json({ success: false, message: "Room is not available for booking" });
    }

    // Calculate number of nights
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const totalPrice = diffDays * room.pricePerNight;

    const booking = await Booking.create({
      user: req.userId,
      room: room._id,
      hotel: room.hotel._id,
      checkInDate: start,
      checkOutDate: end,
      totalPrice,
      guests: Number(guests),
      paymentMethod: paymentMethod || "Pay At Hotel",
      isPaid: paymentMethod === "Stripe", // simulate immediate payment for Stripe
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Room booked successfully",
      booking,
    });
  } catch (error) {
    console.error("Create Booking Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get bookings for logged-in user
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.userId })
      .populate("room")
      .populate("hotel")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error("Get User Bookings Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel Booking
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Verify booking belongs to user
    if (booking.user !== req.userId) {
      return res.status(403).json({ success: false, message: "You are not authorized to cancel this booking" });
    }

    booking.status = "cancelled";
    await booking.save();

    return res.status(200).json({ success: true, message: "Booking cancelled successfully", booking });
  } catch (error) {
    console.error("Cancel Booking Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Pay for Booking (Simulate payment)
export const payBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.user !== req.userId) {
      return res.status(403).json({ success: false, message: "You are not authorized to pay for this booking" });
    }

    booking.isPaid = true;
    booking.status = "confirmed";
    await booking.save();

    return res.status(200).json({ success: true, message: "Payment successful", booking });
  } catch (error) {
    console.error("Pay Booking Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Hotel Owner Dashboard Stats
export const getOwnerDashboard = async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ owner: req.userId });
    if (!hotel) {
      return res.status(404).json({ success: false, message: "No hotel registered for this account" });
    }

    const bookings = await Booking.find({ hotel: hotel._id })
      .populate("user")
      .populate("room")
      .sort({ createdAt: -1 });

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => (b.isPaid ? sum + b.totalPrice : sum), 0);

    // Frontend fix: client uses `item.user.roomType` in Dashboard.jsx.
    // Let's add roomType to user object or map the list safely.
    const mappedBookings = bookings.map((b) => {
      const bObj = b.toObject();
      if (bObj.user && bObj.room) {
        bObj.user.roomType = bObj.room.roomType;
      }
      return bObj;
    });

    return res.status(200).json({
      success: true,
      totalBookings,
      totalRevenue,
      bookings: mappedBookings,
    });
  } catch (error) {
    console.error("Get Owner Dashboard Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
