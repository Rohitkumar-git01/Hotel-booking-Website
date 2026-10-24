import mongoose from "mongoose";
import Hotel, { approvedHotelFilter } from "../models/Hotel.js";
import Room from "../models/Room.js";
import Booking from "../models/Booking.js";
import BookingSlot from "../models/BookingSlot.js";
import User from "../models/User.js";
import { HttpError, badRequest, forbidden, notFound, conflict } from "../utils/httpError.js";
import {
  HOTEL_CATEGORIES,
  HOTEL_AMENITIES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_HOTEL_IMAGES,
} from "../utils/constants.js";
import { uploadImageBuffers, destroyImage } from "../utils/cloudinary.js";
import { geocodeAddress, reverseGeocode } from "../utils/geocode.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const cleanString = (value, maxLength) =>
  isNonEmptyString(value) ? value.trim().slice(0, maxLength) : "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.toLowerCase());
  return Boolean(value);
};

/**
 * Normalises an amenities payload that may arrive as an array, a JSON string,
 * a comma separated string or an object of flags.
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

const normaliseStringArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

/**
 * Validates the shared part of the hotel payload.
 * Returns a normalised object; throws HttpError(400) with a readable message.
 */
const validateHotelPayload = (body, { partial = false } = {}) => {
  const payload = {};
  const errors = {};

  const requireField = (field, label, maxLength) => {
    const value = cleanString(body[field], maxLength);
    if (!value) {
      errors[field] = `${label} is required`;
      return;
    }
    payload[field] = value;
  };

  const optionalField = (field, maxLength) => {
    if (body[field] === undefined) return;
    payload[field] = cleanString(body[field], maxLength);
  };

  if (!partial || body.name !== undefined) requireField("name", "Hotel name", 150);
  if (!partial || body.address !== undefined) requireField("address", "Full address", 400);
  if (!partial || body.city !== undefined) requireField("city", "City", 120);
  if (!partial || body.contact !== undefined) requireField("contact", "Contact phone", 40);

  optionalField("description", 5000);
  optionalField("state", 120);
  optionalField("country", 120);
  optionalField("postalCode", 20);
  optionalField("checkInTime", 20);
  optionalField("checkOutTime", 20);
  optionalField("contactEmail", 200);

  if (body.category !== undefined && body.category !== null && body.category !== "") {
    const category = cleanString(body.category, 60);
    if (!HOTEL_CATEGORIES.includes(category)) {
      errors.category = `Category must be one of: ${HOTEL_CATEGORIES.join(", ")}`;
    } else {
      payload.category = category;
    }
  }

  if (body.contactEmail) {
    const email = cleanString(body.contactEmail, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      errors.contactEmail = "Please enter a valid email address";
    } else {
      payload.contactEmail = email;
    }
  }

  if (body.amenities !== undefined) {
    const amenities = normaliseAmenities(body.amenities);
    const unknown = amenities.filter((item) => !HOTEL_AMENITIES.includes(item));
    if (unknown.length) {
      errors.amenities = `Unknown amenities: ${unknown.slice(0, 5).join(", ")}`;
    } else {
      payload.amenities = amenities;
    }
  }

  // Coordinates: both or neither.
  const hasLat = body.latitude !== undefined && body.latitude !== null && body.latitude !== "";
  const hasLng = body.longitude !== undefined && body.longitude !== null && body.longitude !== "";
  if (hasLat || hasLng) {
    const latitude = parseNumber(body.latitude);
    const longitude = parseNumber(body.longitude);
    if (latitude === null || longitude === null) {
      errors.latitude = "Latitude and longitude must both be valid numbers";
    } else if (latitude < -90 || latitude > 90) {
      errors.latitude = "Latitude must be between -90 and 90";
    } else if (longitude < -180 || longitude > 180) {
      errors.longitude = "Longitude must be between -180 and 180";
    } else {
      payload.latitude = latitude;
      payload.longitude = longitude;
    }
  }

  if (Object.keys(errors).length) {
    throw badRequest("Please correct the highlighted fields.", errors);
  }

  return payload;
};

/**
 * Fields that, when changed by an owner, send the listing back for review.
 */
const MATERIAL_FIELDS = [
  "name",
  "description",
  "category",
  "address",
  "city",
  "state",
  "country",
  "postalCode",
  "latitude",
  "longitude",
  "contact",
  "contactEmail",
  "amenities",
  "checkInTime",
  "checkOutTime",
];

const editsRequireReapproval = () =>
  String(process.env.HOTEL_EDITS_REQUIRE_REAPPROVAL ?? "true").toLowerCase() !== "false";

const assertCanManage = (user, hotel) => {
  if (!user) throw new HttpError(401, "Not authorized");
  if (user.role === "admin") return;
  if (hotel.owner !== user._id) {
    throw forbidden("You are not authorized to manage this hotel");
  }
};

const ownerProjection = "-email";

/** The authenticated user id, regardless of how the route provided it. */
const requestUserId = (req) => req.userId || req.user?._id;

/**
 * Room inventory summary per hotel, used by the listing and detail endpoints.
 */
const buildRoomSummaries = async (hotelIds, { checkIn, checkOut } = {}) => {
  if (!hotelIds.length) return new Map();

  let bookedRoomIds = [];
  if (checkIn && checkOut) {
    const bookedRooms = await BookingSlot.distinct("room", {
      room: { $in: await Room.find({ hotel: { $in: hotelIds } }).distinct("_id") },
      date: { $gte: checkIn, $lt: checkOut },
    });
    bookedRoomIds = bookedRooms.map((id) => new mongoose.Types.ObjectId(String(id)));
  }

  const rows = await Room.aggregate([
    {
      $match: {
        hotel: { $in: hotelIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        isAvailable: true,
        ...(bookedRoomIds.length ? { _id: { $nin: bookedRoomIds } } : {}),
      },
    },
    {
      $group: {
        _id: "$hotel",
        minPrice: { $min: "$pricePerNight" },
        maxPrice: { $max: "$pricePerNight" },
        roomCount: { $sum: 1 },
        roomTypes: { $addToSet: "$roomType" },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), row]));
};

// ---------------------------------------------------------------------------
// Create / register
// ---------------------------------------------------------------------------

/**
 * Creates a hotel for the authenticated user.
 * The listing is always created in the "pending" state and can only be
 * published by an admin. Ownership is derived from the session, never from
 * the request body.
 */
const createHotelForUser = async (user, payload) => {
  const hotel = await Hotel.create({
    ...payload,
    owner: user._id,
    approvalStatus: "pending",
    approvedBy: null,
    approvedAt: null,
    rejectionReason: "",
  });

  // First listing promotes the account to a hotel owner.
  if (user.role === "user") {
    await User.findByIdAndUpdate(user._id, { role: "hotelOwner" });
    user.role = "hotelOwner";
  }

  return hotel;
};

/**
 * POST /api/hotels
 * Legacy alias: POST /api/hotels/register
 */
export const createHotel = async (req, res, next) => {
  try {
    const payload = validateHotelPayload(req.body || {});
    const hotel = await createHotelForUser(req.user, payload);

    return res.status(201).json({
      success: true,
      message:
        "Hotel submitted for review. An admin has to approve the listing before it becomes visible to customers.",
      hotel,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/hotels/register
 * Kept for the existing registration modal. Accepts the original four fields
 * and creates a pending listing, exactly like `createHotel`.
 */
export const registerHotel = async (req, res, next) => {
  try {
    const body = req.body || {};
    const payload = validateHotelPayload({
      name: body.name,
      contact: body.contact,
      address: body.address,
      city: body.city,
      description: body.description,
      category: body.category,
    });

    const hotel = await createHotelForUser(req.user, payload);

    return res.status(201).json({
      success: true,
      message:
        "Hotel registered successfully. It is pending admin approval and will appear in search results once approved.",
      hotel,
    });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// Public listing
// ---------------------------------------------------------------------------

/**
 * GET /api/hotels
 * Public, paginated hotel search. Only approved (and legacy) listings are
 * returned — pending or rejected hotels are never exposed here.
 */
export const getHotels = async (req, res, next) => {
  try {
    const {
      q,
      city,
      category,
      amenities,
      minPrice,
      maxPrice,
      checkIn,
      checkOut,
      sort = "newest",
      page = "1",
      limit = String(DEFAULT_PAGE_SIZE),
    } = req.query;

    const hotelQuery = approvedHotelFilter();

    // --- Text search ----------------------------------------------------
    const searchTerm = cleanString(city || q, 120);
    if (searchTerm) {
      const rx = new RegExp(escapeRegex(searchTerm), "i");
      hotelQuery.$and = [
        {
          $or: [
            { name: rx },
            { city: rx },
            { state: rx },
            { country: rx },
            { address: rx },
          ],
        },
      ];
    }

    // --- Category -------------------------------------------------------
    const categories = normaliseStringArray(category).filter((item) =>
      HOTEL_CATEGORIES.includes(item)
    );
    if (categories.length) {
      hotelQuery.category = { $in: categories };
    }

    // --- Amenities (hotel must provide every requested amenity) ---------
    const requestedAmenities = normaliseStringArray(amenities).filter((item) =>
      HOTEL_AMENITIES.includes(item)
    );
    if (requestedAmenities.length) {
      hotelQuery.amenities = { $all: requestedAmenities };
    }

    const parsedMin = parseNumber(minPrice);
    const parsedMax = parseNumber(maxPrice);
    const hasPriceFilter =
      (parsedMin !== null && parsedMin >= 0) || (parsedMax !== null && parsedMax >= 0);

    // --- Date availability ---------------------------------------------
    let checkInDate = null;
    let checkOutDate = null;
    if (isNonEmptyString(checkIn) && isNonEmptyString(checkOut)) {
      checkInDate = new Date(checkIn);
      checkOutDate = new Date(checkOut);
      if (
        Number.isNaN(checkInDate.getTime()) ||
        Number.isNaN(checkOutDate.getTime()) ||
        checkOutDate <= checkInDate
      ) {
        throw badRequest("Check-out date must be after the check-in date.");
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (checkInDate < today) {
        throw badRequest("Check-in date cannot be in the past.");
      }
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    // Candidate hotels (hotel level filters only). Bounded so a very wide
    // search can never pull an unbounded result set into memory.
    const MAX_CANDIDATES = 2000;
    const candidates = await Hotel.find(hotelQuery)
      .select(
        "name description category address city state country postalCode latitude longitude location contact contactEmail amenities checkInTime checkOutTime images rating reviewCount createdAt"
      )
      .limit(MAX_CANDIDATES)
      .lean();

    const candidateIds = candidates.map((hotel) => hotel._id);
    const summaries = await buildRoomSummaries(candidateIds, {
      checkIn: checkInDate,
      checkOut: checkOutDate,
    });

    // --- Room level filters --------------------------------------------
    let results = candidates
      .map((hotel) => {
        const summary = summaries.get(String(hotel._id));
        return {
          ...hotel,
          minPrice: summary?.minPrice ?? null,
          maxPrice: summary?.maxPrice ?? null,
          roomCount: summary?.roomCount ?? 0,
          roomTypes: summary?.roomTypes ?? [],
          availableForDates: Boolean(checkInDate && checkOutDate) ? summary?.roomCount > 0 : true,
        };
      })
      .filter((hotel) => {
        if (hasPriceFilter) {
          if (hotel.minPrice === null) return false;
          if (parsedMin !== null && parsedMin >= 0 && hotel.maxPrice < parsedMin) return false;
          if (parsedMax !== null && parsedMax >= 0 && hotel.minPrice > parsedMax) return false;
        }
        if (checkInDate && checkOutDate && hotel.roomCount === 0) return false;
        return true;
      });

    // --- Sorting --------------------------------------------------------
    const sortKey = String(sort);
    const byPrice = (direction) => (a, b) => {
      const av = a.minPrice ?? Number.POSITIVE_INFINITY;
      const bv = b.minPrice ?? Number.POSITIVE_INFINITY;
      return direction * (av === bv ? 0 : av < bv ? -1 : 1);
    };

    switch (sortKey) {
      case "price_asc":
        results.sort(byPrice(1));
        break;
      case "price_desc":
        results.sort(byPrice(-1));
        break;
      case "rating":
        results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "name_asc":
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        results.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "newest":
      default:
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    const total = results.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (pageNumber - 1) * pageSize;
    const hotels = results.slice(start, start + pageSize);

    return res.status(200).json({
      success: true,
      hotels,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNext: pageNumber < totalPages,
      },
      filters: {
        city: searchTerm || null,
        categories,
        amenities: requestedAmenities,
        minPrice: parsedMin,
        maxPrice: parsedMax,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        sort: sortKey,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/hotels/:id
 * Public hotel details. Pending/rejected listings are hidden from everyone
 * except their owner and admins (404 for everybody else so the listing
 * cannot be probed).
 */
export const getHotelById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw badRequest("Invalid hotel id");
    }

    const hotel = await Hotel.findById(id).populate("owner", ownerProjection);
    if (!hotel) throw notFound("Hotel not found");

    const isOwnerOfHotel = req.user && hotel.owner?._id === req.user._id;
    const isAdmin = req.user?.role === "admin";
    const isApproved = hotel.approvalStatus === "approved" || !hotel.approvalStatus;

    if (!isApproved && !isOwnerOfHotel && !isAdmin) {
      throw notFound("Hotel not found");
    }

    const checkIn = isNonEmptyString(req.query.checkIn) ? new Date(req.query.checkIn) : null;
    const checkOut = isNonEmptyString(req.query.checkOut) ? new Date(req.query.checkOut) : null;
    const useDates =
      checkIn && checkOut && !Number.isNaN(checkIn.getTime()) && !Number.isNaN(checkOut.getTime());

    const rooms = await Room.find({ hotel: hotel._id }).sort({ pricePerNight: 1 });

    let bookedRoomIds = [];
    if (useDates) {
      const bookedRooms = await BookingSlot.distinct("room", {
        room: { $in: rooms.map((room) => room._id) },
        date: { $gte: checkIn, $lt: checkOut },
      });
      bookedRoomIds = bookedRooms.map((roomId) => String(roomId));
    }

    const decoratedRooms = rooms.map((room) => ({
      ...room.toObject(),
      isAvailableForDates: useDates ? !bookedRoomIds.includes(String(room._id)) : room.isAvailable,
    }));

    // Inventory grouped by room type.
    const typeMap = new Map();
    for (const room of decoratedRooms) {
      const key = room.roomType;
      const entry = typeMap.get(key) || {
        roomType: key,
        total: 0,
        available: 0,
        pricePerNight: room.pricePerNight,
        amenities: room.amenities,
        images: room.images,
      };
      entry.total += 1;
      if (room.isAvailableForDates) entry.available += 1;
      entry.pricePerNight = Math.min(entry.pricePerNight, room.pricePerNight);
      typeMap.set(key, entry);
    }

    const roomTypes = [...typeMap.values()].sort((a, b) => a.pricePerNight - b.pricePerNight);

    return res.status(200).json({
      success: true,
      hotel,
      rooms: decoratedRooms,
      roomTypes,
      availability: useDates ? { checkIn, checkOut } : null,
      viewer: {
        isOwner: Boolean(isOwnerOfHotel),
        isAdmin: Boolean(isAdmin),
        canManage: Boolean(isOwnerOfHotel || isAdmin),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// Owner endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/hotels/my-hotels
 * Every hotel the signed in user manages, with approval status and stats.
 */
export const getMyHotels = async (req, res, next) => {
  try {
    const hotels = await Hotel.find({ owner: req.userId }).sort({ createdAt: -1 });

    const roomCounts = await Room.aggregate([
      { $match: { hotel: { $in: hotels.map((hotel) => hotel._id) } } },
      { $group: { _id: "$hotel", total: { $sum: 1 }, available: { $sum: { $cond: ["$isAvailable", 1, 0] } } } },
    ]);
    const roomCountMap = new Map(roomCounts.map((row) => [String(row._id), row]));

    const bookingCounts = await Booking.aggregate([
      {
        $match: {
          hotel: { $in: hotels.map((hotel) => hotel._id) },
          status: { $ne: "cancelled" },
        },
      },
      { $group: { _id: "$hotel", total: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
    ]);
    const bookingCountMap = new Map(bookingCounts.map((row) => [String(row._id), row]));

    return res.status(200).json({
      success: true,
      hotels: hotels.map((hotel) => ({
        ...hotel.toObject(),
        roomCount: roomCountMap.get(String(hotel._id))?.total ?? 0,
        availableRoomCount: roomCountMap.get(String(hotel._id))?.available ?? 0,
        bookingCount: bookingCountMap.get(String(hotel._id))?.total ?? 0,
        revenue: bookingCountMap.get(String(hotel._id))?.revenue ?? 0,
      })),
      count: hotels.length,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/hotels/my-hotel
 * Legacy single-hotel endpoint used by the existing owner pages. Returns the
 * most recently created hotel of the user.
 */
export const getMyHotel = async (req, res, next) => {
  try {
    const hotel = await Hotel.findOne({ owner: req.userId }).sort({ createdAt: -1 });
    if (!hotel) {
      throw notFound("No hotel registered for this user");
    }
    return res.status(200).json({ success: true, hotel });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/hotels/:id
 * Owners can edit their own hotels, admins can edit any hotel. Owner and
 * approval status can never be set from the request body.
 */
export const updateHotel = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid hotel id");

    const hotel = await Hotel.findById(id);
    if (!hotel) throw notFound("Hotel not found");
    assertCanManage(req.user, hotel);

    const payload = validateHotelPayload(req.body || {}, { partial: true });
    if (payload.images) {
      payload.images = normaliseStringArray(payload.images).slice(0, MAX_HOTEL_IMAGES);
    }

    // A material edit by the owner sends the listing back for review.
    const hasMaterialChange = MATERIAL_FIELDS.some((field) => payload[field] !== undefined);
    const materialChange = req.user.role !== "admin" && hasMaterialChange;

    Object.assign(hotel, payload);
    hotel.markModified("location");

    const needsReview =
      materialChange && editsRequireReapproval() && hotel.approvalStatus === "approved";

    if (needsReview) {
      hotel.approvalStatus = "pending";
      hotel.approvedBy = null;
      hotel.approvedAt = null;
      hotel.rejectionReason = "";
    }

    await hotel.save();

    let message = "Hotel updated successfully";
    if (needsReview) {
      message = "Hotel updated. The listing is pending review again after the update.";
    } else if (hotel.approvalStatus === "pending") {
      message = "Hotel updated. The listing is still waiting for admin approval.";
    }

    return res.status(200).json({
      success: true,
      message,
      hotel,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/hotels/:id
 * Safeguards: hotels with active bookings cannot be deleted unless an admin
 * explicitly forces it.
 */
export const deleteHotel = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid hotel id");

    const hotel = await Hotel.findById(id);
    if (!hotel) throw notFound("Hotel not found");
    assertCanManage(req.user, hotel);

    const force = toBoolean(req.query.force);
    const activeBookings = await Booking.countDocuments({
      hotel: hotel._id,
      status: { $ne: "cancelled" },
    });

    if (activeBookings > 0 && !(force && req.user.role === "admin")) {
      throw conflict(
        `This hotel has ${activeBookings} active booking(s). Cancel them before deleting the listing, or ask an admin to delete it with the force flag.`
      );
    }

    const roomIds = (await Room.find({ hotel: hotel._id }).distinct("_id")).map(String);

    // Remove the listing first so it disappears from every surface even if the
    // cleanup below fails half way.
    await Hotel.deleteOne({ _id: hotel._id });

    await BookingSlot.deleteMany({ hotel: hotel._id });
    if (roomIds.length) {
      await Room.deleteMany({ hotel: hotel._id });
    }

    // Best-effort cleanup of the photos on the CDN.
    for (const image of hotel.images || []) {
      await destroyImage(image);
    }

    return res.status(200).json({
      success: true,
      message: "Hotel deleted successfully",
      deletedRooms: roomIds.length,
    });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/hotels/admin/all
 * Every listing with its owner and approval status.
 */
export const getAdminHotels = async (req, res, next) => {
  try {
    const { status, search, page = "1", limit = "20" } = req.query;

    const query = {};
    if (isNonEmptyString(status) && ["pending", "approved", "rejected"].includes(status)) {
      query.approvalStatus = status;
    } else if (status === "unreviewed") {
      query.approvalStatus = { $exists: false };
    }
    if (isNonEmptyString(search)) {
      const rx = new RegExp(escapeRegex(search.trim().slice(0, 100)), "i");
      query.$or = [{ name: rx }, { city: rx }, { address: rx }];
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || 20));

    const [hotels, total, counts] = await Promise.all([
      Hotel.find(query)
        .populate("owner", ownerProjection)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Hotel.countDocuments(query),
      Promise.all([
        Hotel.countDocuments({ approvalStatus: "pending" }),
        Hotel.countDocuments({ approvalStatus: "approved" }),
        Hotel.countDocuments({ approvalStatus: "rejected" }),
        Hotel.countDocuments({ approvalStatus: { $exists: false } }),
      ]),
    ]);

    const roomCounts = await Room.aggregate([
      { $match: { hotel: { $in: hotels.map((hotel) => hotel._id) } } },
      { $group: { _id: "$hotel", total: { $sum: 1 } } },
    ]);
    const roomCountMap = new Map(roomCounts.map((row) => [String(row._id), row.total]));

    return res.status(200).json({
      success: true,
      hotels: hotels.map((hotel) => ({
        ...hotel.toObject(),
        roomCount: roomCountMap.get(String(hotel._id)) ?? 0,
      })),
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      counts: {
        pending: counts[0],
        approved: counts[1],
        rejected: counts[2],
        unreviewed: counts[3],
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/hotels/:id/approve
 */
export const approveHotel = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid hotel id");

    const hotel = await Hotel.findById(id);
    if (!hotel) throw notFound("Hotel not found");

    hotel.approvalStatus = "approved";
    hotel.rejectionReason = "";
    hotel.approvedBy = requestUserId(req);
    hotel.approvedAt = new Date();
    await hotel.save();

    return res.status(200).json({
      success: true,
      message: `"${hotel.name}" has been approved and is now visible to customers.`,
      hotel,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/hotels/:id/reject
 */
export const rejectHotel = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid hotel id");

    const reason = cleanString(req.body?.reason, 1000);
    if (!reason) {
      throw badRequest("Please provide a reason so the owner knows what to fix.", {
        reason: "Rejection reason is required",
      });
    }

    const hotel = await Hotel.findById(id);
    if (!hotel) throw notFound("Hotel not found");

    hotel.approvalStatus = "rejected";
    hotel.rejectionReason = reason;
    hotel.approvedBy = null;
    hotel.approvedAt = null;
    await hotel.save();

    return res.status(200).json({
      success: true,
      message: `"${hotel.name}" has been rejected.`,
      hotel,
    });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * POST /api/hotels/:id/images
 */
export const uploadHotelImages = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid hotel id");

    const hotel = await Hotel.findById(id);
    if (!hotel) throw notFound("Hotel not found");
    assertCanManage(req.user, hotel);

    const files = req.files || [];
    if (!files.length) {
      throw badRequest("Select at least one image to upload.");
    }

    const { uploaded, failures } = await uploadImageBuffers(files, { folder: "quickstay/hotels" });

    hotel.images.push(...uploaded.map((image) => image.url));
    hotel.imageIds.push(...uploaded.map((image) => image.publicId));
    hotel.images = hotel.images.slice(0, MAX_HOTEL_IMAGES);
    hotel.imageIds = hotel.imageIds.slice(0, MAX_HOTEL_IMAGES);
    await hotel.save();

    return res.status(201).json({
      success: true,
      message:
        uploaded.length === 1
          ? "Image uploaded successfully"
          : `${uploaded.length} images uploaded successfully`,
      images: hotel.images,
      imageIds: hotel.imageIds,
      ...(failures.length
        ? { warnings: failures.map((failure) => `${failure.name}: ${failure.message}`) }
        : {}),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/hotels/:id/images/:index
 */
export const removeHotelImage = async (req, res, next) => {
  try {
    const { id, index } = req.params;
    if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid hotel id");

    const hotel = await Hotel.findById(id);
    if (!hotel) throw notFound("Hotel not found");
    assertCanManage(req.user, hotel);

    const imageIndex = Number.parseInt(index, 10);
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= hotel.images.length) {
      throw badRequest("Image not found");
    }

    const [removed] = hotel.images.splice(imageIndex, 1);
    hotel.imageIds.splice(imageIndex, 1);
    await hotel.save();

    await destroyImage(removed);

    return res.status(200).json({
      success: true,
      message: "Image removed",
      images: hotel.images,
      imageIds: hotel.imageIds,
    });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// Geocoding proxy
// ---------------------------------------------------------------------------

/**
 * GET /api/hotels/geocode?q=...
 */
export const geocode = async (req, res, next) => {
  try {
    const query = cleanString(req.query.q || req.query.query, 200);
    if (!query) {
      throw badRequest("Enter a city or address to search.");
    }
    const results = await geocodeAddress(query, { limit: req.query.limit });
    return res.status(200).json({ success: true, results });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/hotels/reverse-geocode?lat=..&lon=..
 */
export const reverseGeocodeHandler = async (req, res, next) => {
  try {
    const latitude = parseNumber(req.query.lat ?? req.query.latitude);
    const longitude = parseNumber(req.query.lon ?? req.query.longitude);

    if (latitude === null || longitude === null) {
      throw badRequest("Latitude and longitude are required.");
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw badRequest("Coordinates are out of range.");
    }

    const result = await reverseGeocode(latitude, longitude);
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return next(error);
  }
};
