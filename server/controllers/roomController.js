import mongoose from "mongoose";
import Room from "../models/Room.js";
import Hotel, { approvedHotelFilter } from "../models/Hotel.js";
import Booking from "../models/Booking.js";
import BookingSlot from "../models/BookingSlot.js";
import { HttpError, badRequest, forbidden, notFound, conflict } from "../utils/httpError.js";
import { ROOM_TYPES, MAX_ROOM_IMAGES } from "../utils/constants.js";
import { uploadImageBuffers, destroyImage } from "../utils/cloudinary.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Escape user input before using it inside a RegExp, so a query like `?city=[`
// cannot throw a SyntaxError (which surfaced as a 500).
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const cleanString = (value, maxLength) =>
  isNonEmptyString(value) ? value.trim().slice(0, maxLength) : "";

const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Normalises an amenities payload that may arrive as an array, a stringified
 * JSON array, a comma separated string or an object of flags.
 */
const normaliseAmenities = (value) => {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = parsed.split(",");
    }
  }
  if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
    parsed = Object.keys(parsed).filter((key) => parsed[key]);
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))].slice(0, 40);
};

const assertCanManageHotel = (user, hotel) => {
  if (!user) throw new HttpError(401, "Not authorized");
  if (user.role === "admin") return;
  if (hotel.owner !== user._id) {
    throw forbidden("You are not authorized to manage rooms for this hotel");
  }
};

/**
 * Resolves the hotel a room operation applies to.
 * `hotelId` is optional for backwards compatibility: when it is missing the
 * owner's first hotel is used.
 */
const resolveOwnerHotel = async (user, hotelId) => {
  if (hotelId) {
    if (!mongoose.isValidObjectId(hotelId)) throw badRequest("Invalid hotel id");
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) throw notFound("Hotel not found");
    assertCanManageHotel(user, hotel);
    return hotel;
  }

  const fallback = await Hotel.findOne({ owner: user._id }).sort({ createdAt: 1 });
  if (!fallback) {
    throw notFound("You need to register a hotel before adding rooms");
  }
  if (user.role !== "admin") {
    // Admins may act on any hotel, owners only on their own.
    assertCanManageHotel(user, fallback);
  }
  return fallback;
};

/**
 * Rooms that are taken for the given date range.
 */
const getBookedRoomIds = async (roomIds, checkIn, checkOut) => {
  if (!roomIds.length || !checkIn || !checkOut) return [];
  const booked = await BookingSlot.distinct("room", {
    room: { $in: roomIds },
    date: { $gte: checkIn, $lt: checkOut },
  });
  return booked.map((id) => String(id));
};

/**
 * The set of hotels a customer may see (approved, plus legacy listings).
 */
const getApprovedHotelIds = async (cityFilter) => {
  const query = approvedHotelFilter();
  if (isNonEmptyString(cityFilter)) {
    const rx = new RegExp(escapeRegex(cityFilter.trim().slice(0, 100)), "i");
    query.$and = [{ $or: [{ city: rx }, { name: rx }, { address: rx }, { state: rx }, { country: rx }] }];
  }
  return Hotel.find(query).distinct("_id");
};

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

/**
 * POST /api/rooms
 * Adds a room to a hotel. The hotel must belong to the signed in owner
 * (admins may add rooms to any hotel).
 */
export const addRoom = async (req, res, next) => {
  try {
    const { roomType, pricePerNight, amenities, capacity, description, hotelId } = req.body || {};

    if (!roomType || pricePerNight === undefined || pricePerNight === null || pricePerNight === "") {
      throw badRequest("Room type and price per night are required");
    }

    const hotel = await resolveOwnerHotel(req.user, hotelId);

    const normalisedRoomType = cleanString(roomType, 60);
    if (!ROOM_TYPES.includes(normalisedRoomType)) {
      throw badRequest(`Room type must be one of: ${ROOM_TYPES.join(", ")}`);
    }

    const price = parseNumber(pricePerNight);
    if (price === null || price <= 0) {
      throw badRequest("Price per night must be a positive number");
    }

    const parsedCapacity = capacity === undefined ? null : parseNumber(capacity);
    if (parsedCapacity !== null && (!Number.isInteger(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 20)) {
      throw badRequest("Capacity must be a whole number between 1 and 20");
    }

    // Handle amenities (client might send as array or stringified JSON or comma-separated string)
    const processedAmenities = normaliseAmenities(amenities);

    // Handle image uploads
    const imageUrls = [];
    const imageIds = [];
    if (req.files && req.files.length > 0) {
      const { uploaded, failures } = await uploadImageBuffers(req.files, {
        folder: "quickstay/rooms",
      });
      imageUrls.push(...uploaded.map((image) => image.url));
      imageIds.push(...uploaded.map((image) => image.publicId));
      if (failures.length) {
        console.warn("Some room images could not be uploaded:", failures);
      }
    }

    const newRoom = await Room.create({
      hotel: hotel._id,
      roomType: normalisedRoomType,
      pricePerNight: price,
      capacity: parsedCapacity ?? 2,
      description: cleanString(description, 2000),
      amenities: processedAmenities,
      images: imageUrls.slice(0, MAX_ROOM_IMAGES),
      imageIds: imageIds.slice(0, MAX_ROOM_IMAGES),
      isAvailable: true,
    });

    return res.status(201).json({
      success: true,
      message: "Room added successfully",
      room: newRoom,
      hotel: { _id: hotel._id, name: hotel.name },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/rooms/:id
 */
export const updateRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid room id");

    const room = await Room.findById(id);
    if (!room) throw notFound("Room not found");

    const hotel = await Hotel.findById(room.hotel);
    if (!hotel) throw notFound("Hotel not found");
    assertCanManageHotel(req.user, hotel);

    const body = req.body || {};

    if (body.roomType !== undefined) {
      const roomType = cleanString(body.roomType, 60);
      if (!ROOM_TYPES.includes(roomType)) {
        throw badRequest(`Room type must be one of: ${ROOM_TYPES.join(", ")}`);
      }
      room.roomType = roomType;
    }

    if (body.pricePerNight !== undefined) {
      const price = parseNumber(body.pricePerNight);
      if (price === null || price <= 0) {
        throw badRequest("Price per night must be a positive number");
      }
      room.pricePerNight = price;
    }

    if (body.capacity !== undefined) {
      const capacity = parseNumber(body.capacity);
      if (capacity === null || !Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
        throw badRequest("Capacity must be a whole number between 1 and 20");
      }
      room.capacity = capacity;
    }

    if (body.description !== undefined) {
      room.description = cleanString(body.description, 2000);
    }

    if (body.amenities !== undefined) {
      room.amenities = normaliseAmenities(body.amenities);
    }

    if (body.isAvailable !== undefined) {
      room.isAvailable = body.isAvailable === true || body.isAvailable === "true";
    }

    if (body.images !== undefined) {
      room.images = (Array.isArray(body.images) ? body.images : [])
        .map((image) => cleanString(image, 500))
        .filter(Boolean)
        .slice(0, MAX_ROOM_IMAGES);
    }

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      room,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/rooms/:id
 */
export const deleteRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid room id");

    const room = await Room.findById(id);
    if (!room) throw notFound("Room not found");

    const hotel = await Hotel.findById(room.hotel);
    if (!hotel) throw notFound("Hotel not found");
    assertCanManageHotel(req.user, hotel);

    const activeBookings = await Booking.countDocuments({
      room: room._id,
      status: { $ne: "cancelled" },
    });

    if (activeBookings > 0) {
      throw conflict(
        `This room has ${activeBookings} active booking(s). Cancel them before deleting the room.`
      );
    }

    await BookingSlot.deleteMany({ room: room._id });
    await Room.deleteOne({ _id: room._id });

    for (const image of room.images || []) {
      await destroyImage(image);
    }

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * GET /api/rooms/list
 * Public room search. Rooms that belong to a hotel which is not approved are
 * never returned.
 */
export const getRooms = async (req, res, next) => {
  try {
    const { roomTypes, priceRanges, sort, city, checkIn, checkOut } = req.query;

    const query = { isAvailable: true };

    // 1. Only rooms of approved hotels are public.
    const approvedHotelIds = await getApprovedHotelIds(city);
    if (!approvedHotelIds.length) {
      return res.status(200).json({ success: true, rooms: [], count: 0 });
    }
    query.hotel = { $in: approvedHotelIds };

    // 2. Filter by Room Types
    if (isNonEmptyString(roomTypes)) {
      const typesArray = roomTypes
        .split(",")
        .map((type) => type.trim())
        .filter(Boolean);
      if (typesArray.length > 0) {
        query.roomType = { $in: typesArray };
      }
    }

    // 3. Filter by Price Ranges
    if (isNonEmptyString(priceRanges)) {
      const rangesArray = priceRanges.split(",");
      const priceQueryConditions = [];

      rangesArray.forEach((range) => {
        const cleanRange = range.replace(/\$/g, "").trim().toLowerCase();
        if (cleanRange.includes("and above")) {
          const minVal = parseInt(cleanRange.split(" ")[0], 10);
          if (Number.isFinite(minVal)) {
            priceQueryConditions.push({ pricePerNight: { $gte: minVal } });
          }
        } else if (cleanRange.includes("to")) {
          const parts = cleanRange.split("to");
          const min = parseInt(parts[0].trim(), 10);
          const max = parseInt(parts[1].trim(), 10);
          if (Number.isFinite(min) && Number.isFinite(max)) {
            priceQueryConditions.push({ pricePerNight: { $gte: min, $lte: max } });
          }
        }
      });

      if (priceQueryConditions.length > 0) {
        query.$or = priceQueryConditions;
      }
    }

    // 4. Availability for the requested dates.
    if (isNonEmptyString(checkIn) && isNonEmptyString(checkOut)) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw badRequest("Check-out date must be after the check-in date.");
      }
      const candidateRooms = await Room.find(query).distinct("_id");
      const bookedRoomIds = await getBookedRoomIds(candidateRooms, start, end);
      if (bookedRoomIds.length) {
        query._id = { $nin: bookedRoomIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
      }
    }

    let sortOption = {};
    // 5. Sorting Options
    if (sort) {
      if (sort === "Price: Low to High") {
        sortOption.pricePerNight = 1;
      } else if (sort === "Price: High to Low") {
        sortOption.pricePerNight = -1;
      } else {
        sortOption.createdAt = -1;
      }
    } else {
      sortOption.createdAt = -1;
    }

    const rooms = await Room.find(query)
      .populate("hotel")
      .sort(sortOption);

    return res.status(200).json({ success: true, rooms, count: rooms.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/rooms/:id
 */
export const getRoomById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid room id");

    const room = await Room.findById(id).populate({
      path: "hotel",
      populate: {
        path: "owner",
        select: "-email",
      },
    });

    if (!room) throw notFound("Room not found");

    // Rooms of unapproved hotels stay hidden from the public.
    const hotel = room.hotel;
    const isApproved = !hotel?.approvalStatus || hotel.approvalStatus === "approved";
    const isOwner = req.user && hotel?.owner?._id === req.user._id;
    const isAdmin = req.user?.role === "admin";
    if (!isApproved && !isOwner && !isAdmin) {
      throw notFound("Room not found");
    }

    return res.status(200).json({ success: true, room });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/rooms/my-rooms
 * Every room of every hotel the signed in user owns.
 */
export const getMyRooms = async (req, res, next) => {
  try {
    const { hotelId } = req.query;

    let hotels;
    if (hotelId) {
      if (!mongoose.isValidObjectId(hotelId)) throw badRequest("Invalid hotel id");
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) throw notFound("Hotel not found");
      assertCanManageHotel(req.user, hotel);
      hotels = [hotel];
    } else {
      hotels = await Hotel.find(
        req.user.role === "admin" ? {} : { owner: req.userId }
      ).sort({ createdAt: -1 });
    }

    const hotelIds = hotels.map((hotel) => hotel._id);
    const rooms = await Room.find({ hotel: { $in: hotelIds } })
      .populate("hotel", "name city approvalStatus")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, rooms, count: rooms.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/rooms/hotel/:hotelId
 * Rooms of a single hotel. Public for approved hotels, owner/admin otherwise.
 */
export const getHotelRooms = async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    if (!mongoose.isValidObjectId(hotelId)) throw badRequest("Invalid hotel id");

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) throw notFound("Hotel not found");

    const isApproved = !hotel.approvalStatus || hotel.approvalStatus === "approved";
    const isOwner = req.user && hotel.owner === req.user._id;
    const isAdmin = req.user?.role === "admin";
    if (!isApproved && !isOwner && !isAdmin) {
      throw notFound("Hotel not found");
    }

    const rooms = await Room.find({ hotel: hotel._id }).sort({ pricePerNight: 1 });

    return res.status(200).json({
      success: true,
      rooms,
      count: rooms.length,
      hotel: { _id: hotel._id, name: hotel.name, approvalStatus: hotel.approvalStatus },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/rooms/hotel/:hotelId/types
 * Inventory per room type: how many rooms exist and how many are free for the
 * requested dates.
 */
export const getHotelRoomTypes = async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    if (!mongoose.isValidObjectId(hotelId)) throw badRequest("Invalid hotel id");

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) throw notFound("Hotel not found");

    const isApproved = !hotel.approvalStatus || hotel.approvalStatus === "approved";
    const isOwner = req.user && hotel.owner === req.user._id;
    const isAdmin = req.user?.role === "admin";
    if (!isApproved && !isOwner && !isAdmin) {
      throw notFound("Hotel not found");
    }

    const rooms = await Room.find({ hotel: hotel._id }).sort({ pricePerNight: 1 });
    const roomIds = rooms.map((room) => room._id);

    let checkIn = null;
    let checkOut = null;
    if (isNonEmptyString(req.query.checkIn) && isNonEmptyString(req.query.checkOut)) {
      checkIn = new Date(req.query.checkIn);
      checkOut = new Date(req.query.checkOut);
      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
        throw badRequest("Check-out date must be after the check-in date.");
      }
    }

    const bookedRoomIds = await getBookedRoomIds(roomIds, checkIn, checkOut);
    const bookedSet = new Set(bookedRoomIds);

    const typeMap = new Map();
    for (const room of rooms) {
      const entry =
        typeMap.get(room.roomType) || {
          roomType: room.roomType,
          total: 0,
          available: 0,
          pricePerNight: room.pricePerNight,
          capacity: room.capacity,
          amenities: [],
          images: [],
        };
      entry.total += 1;
      if (room.isAvailable && !bookedSet.has(String(room._id))) {
        entry.available += 1;
      }
      entry.pricePerNight = Math.min(entry.pricePerNight, room.pricePerNight);
      entry.capacity = Math.max(entry.capacity ?? 0, room.capacity ?? 0);
      entry.amenities = [...new Set([...entry.amenities, ...(room.amenities || [])])];
      entry.images = [...new Set([...entry.images, ...(room.images || [])])];
      typeMap.set(room.roomType, entry);
    }

    const roomTypes = [...typeMap.values()].sort((a, b) => a.pricePerNight - b.pricePerNight);

    return res.status(200).json({
      success: true,
      roomTypes,
      count: roomTypes.length,
      totalRooms: rooms.length,
      availability: checkIn && checkOut ? { checkIn, checkOut } : null,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/rooms/availability/:roomId
 */
export const checkRoomAvailability = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) throw badRequest("Invalid room id");

    const room = await Room.findById(roomId);
    if (!room) throw notFound("Room not found");

    const checkIn = new Date(req.query.checkIn);
    const checkOut = new Date(req.query.checkOut);
    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime()) ||
      checkOut <= checkIn
    ) {
      throw badRequest("Valid check-in and check-out dates are required.");
    }

    const bookedRoomIds = await getBookedRoomIds([room._id], checkIn, checkOut);
    const isBooked = bookedRoomIds.includes(String(room._id));

    return res.status(200).json({
      success: true,
      available: room.isAvailable && !isBooked,
      reason: !room.isAvailable
        ? "This room is marked unavailable by the hotel."
        : isBooked
        ? "This room is already booked for the selected dates."
        : null,
      room: { _id: room._id, hotel: room.hotel, roomType: room.roomType },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/rooms/toggle/:roomId
 */
export const toggleAvailability = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) throw badRequest("Invalid room id");

    const room = await Room.findById(roomId).populate("hotel");
    if (!room) throw notFound("Room not found");

    // Verify ownership
    assertCanManageHotel(req.user, room.hotel);

    room.isAvailable = !room.isAvailable;
    await room.save();

    return res.status(200).json({
      success: true,
      message: `Room status updated to ${room.isAvailable ? "Available" : "Unavailable"}`,
      room,
    });
  } catch (error) {
    return next(error);
  }
};
