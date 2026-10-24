import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import Hotel from "../models/Hotel.js";
import BookingSlot from "../models/BookingSlot.js";
import { HttpError, badRequest, forbidden, notFound, conflict } from "../utils/httpError.js";
import { PAYMENT_METHODS, PAY_AT_HOTEL } from "../utils/constants.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const MAX_GUESTS = 20;

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** UTC midnight of the calendar day the date falls on. */
const toUtcMidnight = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/**
 * The list of nights a stay covers. Each night becomes one inventory lock.
 */
const buildNightDates = (start, nights) => {
  const firstNight = toUtcMidnight(start);
  const dates = [];
  for (let index = 0; index < nights; index += 1) {
    dates.push(new Date(firstNight.getTime() + index * DAY_MS));
  }
  return dates;
};

/**
 * Releases the inventory locks of a booking.
 */
const releaseSlots = async (bookingId) => {
  try {
    await BookingSlot.deleteMany({ booking: bookingId });
  } catch (error) {
    console.error("Could not release booking slots:", error.message);
  }
};

// Create a Room Booking
export const createBooking = async (req, res, next) => {
  try {
    const { roomId, checkInDate, checkOutDate, guests, paymentMethod } = req.body || {};

    if (!roomId || !checkInDate || !checkOutDate || guests === undefined || guests === null || guests === "") {
      throw badRequest("Missing required booking details");
    }

    if (!mongoose.isValidObjectId(roomId)) {
      throw badRequest("Invalid room id");
    }

    // --- Validate dates ------------------------------------------------
    const start = parseDate(checkInDate);
    const end = parseDate(checkOutDate);

    if (!start || !end) {
      throw badRequest("Check-in and check-out must be valid dates");
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (start < todayStart) {
      throw badRequest("Check-in date cannot be in the past");
    }

    // Previously reversed dates were accepted (Math.abs) and billed anyway.
    if (end <= start) {
      throw badRequest("Check-out date must be after the check-in date");
    }

    const nights = Math.ceil((end - start) / DAY_MS);
    if (!Number.isFinite(nights) || nights < 1) {
      throw badRequest("Booking must be at least one night");
    }
    if (nights > 60) {
      throw badRequest("Stays longer than 60 nights are not supported");
    }

    // --- Validate guests -----------------------------------------------
    const guestCount = Number(guests);
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      throw badRequest("Guests must be a whole number of at least 1");
    }
    if (guestCount > MAX_GUESTS) {
      throw badRequest(
        `For groups larger than ${MAX_GUESTS} guests, please contact the hotel directly`
      );
    }

    // --- Validate payment method ---------------------------------------
    const method = paymentMethod || PAY_AT_HOTEL;
    if (!PAYMENT_METHODS.includes(method)) {
      throw badRequest(
        `Unsupported payment method. Choose one of: ${PAYMENT_METHODS.join(", ")}`
      );
    }

    const room = await Room.findById(roomId).populate("hotel");
    if (!room) {
      throw notFound("Room not found");
    }

    if (!room.isAvailable) {
      throw badRequest("Room is not available for booking");
    }

    const hotel = room.hotel;
    if (!hotel) {
      throw notFound("The hotel for this room no longer exists");
    }

    // Only approved hotels can be booked. Pending/rejected listings stay
    // invisible to customers, so they must not be bookable either.
    if (hotel.approvalStatus && hotel.approvalStatus !== "approved") {
      throw forbidden("This hotel is not open for bookings yet");
    }

    if (room.capacity && guestCount > room.capacity) {
      throw badRequest(
        `This room can host up to ${room.capacity} guest(s). Please reduce the number of guests.`
      );
    }

    // --- Reject overlapping bookings ------------------------------------
    // Two ranges overlap when existing.checkIn < new.checkOut
    //                        AND existing.checkOut > new.checkIn
    const conflictingBooking = await Booking.findOne({
      room: room._id,
      status: { $ne: "cancelled" },
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
    });

    if (conflictingBooking) {
      throw conflict(
        "This room is already booked for the selected dates. Please choose different dates."
      );
    }

    const totalPrice = nights * room.pricePerNight;
    const isPaid = method !== PAY_AT_HOTEL;

    // --- Reserve the inventory atomically -------------------------------
    // One lock document per night. The unique { room, date } index makes sure
    // two concurrent requests can never sell the same room twice.
    const bookingId = new mongoose.Types.ObjectId();
    const nightDates = buildNightDates(start, nights);

    try {
      await BookingSlot.insertMany(
        nightDates.map((date) => ({
          room: room._id,
          hotel: hotel._id,
          booking: bookingId,
          date,
        })),
        { ordered: true }
      );
    } catch (slotError) {
      if (slotError?.code === 11000) {
        // Another request took one of the nights first.
        await releaseSlots(bookingId);
        throw conflict(
          "This room was just booked for the selected dates. Please choose different dates."
        );
      }
      await releaseSlots(bookingId);
      throw slotError;
    }

    let booking;
    try {
      booking = await Booking.create({
        _id: bookingId,
        user: req.userId,
        room: room._id,
        hotel: hotel._id,
        checkInDate: start,
        checkOutDate: end,
        totalPrice,
        guests: guestCount,
        paymentMethod: method,
        isPaid,
        status: isPaid ? "confirmed" : "pending",
      });
    } catch (bookingError) {
      // The booking could not be written, so the locks have to go back.
      await releaseSlots(bookingId);
      throw bookingError;
    }

    return res.status(201).json({
      success: true,
      message: "Room booked successfully",
      booking,
    });
  } catch (error) {
    return next(error);
  }
};

// Get bookings for logged-in user
export const getUserBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.userId })
      .populate("room")
      .populate("hotel")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, bookings, count: bookings.length });
  } catch (error) {
    return next(error);
  }
};

// Cancel Booking
export const cancelBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    if (!mongoose.isValidObjectId(bookingId)) throw badRequest("Invalid booking id");

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw notFound("Booking not found");
    }

    // Verify booking belongs to user
    if (booking.user !== req.userId) {
      throw forbidden("You are not authorized to cancel this booking");
    }

    booking.status = "cancelled";
    await booking.save();

    // Return the reserved nights to the inventory pool.
    await releaseSlots(booking._id);

    return res.status(200).json({ success: true, message: "Booking cancelled successfully", booking });
  } catch (error) {
    return next(error);
  }
};

// Pay for Booking (Simulate payment)
export const payBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    if (!mongoose.isValidObjectId(bookingId)) throw badRequest("Invalid booking id");

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw notFound("Booking not found");
    }

    if (booking.user !== req.userId) {
      throw forbidden("You are not authorized to pay for this booking");
    }

    const { paymentMethod } = req.body || {};
    if (paymentMethod !== undefined) {
      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw badRequest(
          `Unsupported payment method. Choose one of: ${PAYMENT_METHODS.join(", ")}`
        );
      }
      booking.paymentMethod = paymentMethod;
    }

    // "Pay At Hotel" is settled at check-in, so it must not be recorded as paid.
    if (booking.paymentMethod === PAY_AT_HOTEL) {
      booking.isPaid = false;
      booking.status = booking.status === "cancelled" ? "cancelled" : "pending";
      await booking.save();
      return res.status(200).json({
        success: true,
        message: "Booking confirmed. Payment will be collected at the hotel.",
        booking,
      });
    }

    booking.isPaid = true;
    booking.status = "confirmed";
    await booking.save();

    return res.status(200).json({ success: true, message: "Payment successful", booking });
  } catch (error) {
    return next(error);
  }
};

// Get Hotel Owner Dashboard Stats (across every hotel of the owner)
export const getOwnerDashboard = async (req, res, next) => {
  try {
    const { hotelId } = req.query;

    let hotelQuery = {};
    if (hotelId) {
      if (!mongoose.isValidObjectId(hotelId)) throw badRequest("Invalid hotel id");
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) throw notFound("Hotel not found");
      if (req.user.role !== "admin" && hotel.owner !== req.userId) {
        throw forbidden("You are not authorized to view this hotel");
      }
      hotelQuery = { _id: hotel._id };
    } else if (req.user.role === "admin") {
      hotelQuery = {};
    } else {
      hotelQuery = { owner: req.userId };
    }

    const hotels = await Hotel.find(hotelQuery).select("_id name city approvalStatus");
    const hotelIds = hotels.map((hotel) => hotel._id);

    if (!hotelIds.length) {
      return res.status(200).json({
        success: true,
        totalBookings: 0,
        totalRevenue: 0,
        bookings: [],
        hotels: [],
      });
    }

    const bookings = await Booking.find({ hotel: { $in: hotelIds } })
      .populate("user", "-email")
      .populate("room")
      .sort({ createdAt: -1 });

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => (b.isPaid ? sum + b.totalPrice : sum), 0);

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
      hotels,
      hotelCount: hotels.length,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/bookings/room/:roomId
 * Availability of a room for a date range (public).
 */
export const getRoomAvailability = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) throw badRequest("Invalid room id");

    const room = await Room.findById(roomId);
    if (!room) throw notFound("Room not found");

    const start = parseDate(req.query.checkIn);
    const end = parseDate(req.query.checkOut);
    if (!start || !end || end <= start) {
      throw badRequest("Valid check-in and check-out dates are required.");
    }

    const bookedRooms = await BookingSlot.distinct("room", {
      room: room._id,
      date: { $gte: toUtcMidnight(start), $lt: toUtcMidnight(end) },
    });

    const legacyConflict = await Booking.exists({
      room: room._id,
      status: { $ne: "cancelled" },
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
    });

    const available = room.isAvailable && !bookedRooms.length && !legacyConflict;

    return res.status(200).json({
      success: true,
      available,
      room: { _id: room._id, roomType: room.roomType, pricePerNight: room.pricePerNight },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/bookings/:bookingId
 */
export const getBookingById = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    if (!mongoose.isValidObjectId(bookingId)) throw badRequest("Invalid booking id");

    const booking = await Booking.findById(bookingId)
      .populate("room")
      .populate("hotel")
      .populate("user", "-email");

    if (!booking) throw notFound("Booking not found");

    const isOwner = booking.user?._id === req.userId;
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      throw forbidden("You are not authorized to view this booking");
    }

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return next(error);
  }
};
