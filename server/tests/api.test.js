// ---------------------------------------------------------------------------
// QuickStay integration tests.
//
// They run against a real MongoDB (set MONGODB_URI to a throw-away database)
// and exercise the controllers and the authorisation middleware directly.
//
//   npm test
//   MONGODB_URI_TEST=mongodb://127.0.0.1:27017/quickstay-test npm test
//
// The suite empties the collections of the database it connects to, so it
// refuses to run against a remote host unless ALLOW_REMOTE_TEST_DB=1 is set.
//
// The suite covers the requirements of the multi-hotel listing system:
// permissions, the approval workflow, coordinates, room/hotel association,
// search, booking (including the concurrent oversell case) and backwards
// compatibility with the records that existed before this feature.
// ---------------------------------------------------------------------------

import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.SKIP_SEED = "1";
process.env.VERCEL = "1"; // stop server.js from opening a port
process.env.HOTEL_EDITS_REQUIRE_REAPPROVAL = "true";
process.env.NODE_ENV = "test";

// The tests always run against a local throw-away database. `dotenv/config`
// (loaded by configs/db.js) never overrides an already exported variable, so
// this wins over the MONGODB_URI from the .env file.
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017/quickstay-test";

// The database name is set explicitly as well, because `configs/db.js` pins
// the name of the database and would otherwise use the production one.
process.env.MONGODB_DB_NAME =
  process.env.MONGODB_DB_NAME_TEST || "quickstay-test";

// ---------------------------------------------------------------------------
// Safety guard
// ---------------------------------------------------------------------------
// This suite wipes the collections of the database it connects to. Running it
// against the production database would delete every hotel, room and booking.
// The suite therefore refuses to start when the target is not a local MongoDB
// unless the operator opts in explicitly.
const targetHost = (() => {
  try {
    const url = new URL(process.env.MONGODB_URI);
    return url.hostname;
  } catch {
    return "";
  }
})();

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

if (
  !LOCAL_HOSTS.includes(targetHost) &&
  process.env.ALLOW_REMOTE_TEST_DB !== "1"
) {
  console.error(
    [
      "",
      "REFUSING TO RUN THE TESTS AGAINST A REMOTE DATABASE.",
      "",
      `  Target host : ${targetHost || "unknown"}`,
      `  Database    : ${process.env.MONGODB_DB_NAME}`,
      "",
      "The test suite deletes all documents of the target database before it",
      "starts. Set ALLOW_REMOTE_TEST_DB=1 to run against a remote throw-away",
      "database on purpose.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const { default: connectDB } = await import("../configs/db.js");
const { default: Hotel } = await import("../models/Hotel.js");
const { default: Room } = await import("../models/Room.js");
const { default: Booking } = await import("../models/Booking.js");
const { default: BookingSlot } = await import("../models/BookingSlot.js");
const { default: User } = await import("../models/User.js");

const hotelController = await import("../controllers/hotelController.js");
const roomController = await import("../controllers/roomController.js");
const bookingController = await import("../controllers/bookingController.js");
const { isAdmin, isOwner, protect } = await import("../middleware/authMiddleware.js");

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockRes = () => {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  res.setHeader = () => res;
  return res;
};

/**
 * Calls a controller and returns { status, body }. Thrown errors are
 * converted into the response the real error middleware would produce.
 */
const call = async (handler, req) => {
  // The auth middleware sets both `req.user` and `req.userId`.
  if (req.user && !req.userId) req.userId = req.user._id;

  const res = mockRes();
  let error = null;
  await handler(req, res, (err) => {
    error = err;
  });
  if (error) {
    return { status: error.status || 500, body: { success: false, message: error.message }, error };
  }
  return { status: res.statusCode, body: res.body };
};

const makeUser = async (id, role) => {
  await User.deleteOne({ _id: id });
  return User.create({
    _id: id,
    username: id,
    email: `${id}@example.com`,
    role,
  });
};

const OWNER = "user_owner_alpha";
const OWNER_B = "user_owner_beta";
const ADMIN = "user_admin_root";
const CUSTOMER = "user_customer_one";

const iso = (offsetDays) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

let approvedHotel;
let pendingHotel;
let unapprovedHotel;
let legacyHotel;
let roomInApprovedHotel;

test.before(async () => {
  await connectDB();
  await Promise.all([
    Hotel.deleteMany({}),
    Room.deleteMany({}),
    Booking.deleteMany({}),
    BookingSlot.deleteMany({}),
    User.deleteMany({}),
  ]);

  await makeUser(OWNER, "hotelOwner");
  await makeUser(OWNER_B, "hotelOwner");
  await makeUser(ADMIN, "admin");
  await makeUser(CUSTOMER, "user");

  // A hotel that was approved by an admin.
  approvedHotel = await Hotel.create({
    name: "Harbour View Resort",
    description: "A seaside resort.",
    category: "Resort",
    address: "12 Marine Drive",
    city: "Singapore",
    state: "Central",
    country: "Singapore",
    postalCode: "018956",
    latitude: 1.29027,
    longitude: 103.851959,
    contact: "+6599990001",
    contactEmail: "stay@harbourview.example.com",
    amenities: ["Free WiFi", "Pool Access"],
    checkInTime: "2:00 PM",
    checkOutTime: "11:00 AM",
    images: [],
    owner: OWNER,
    approvalStatus: "approved",
    approvedBy: ADMIN,
    approvedAt: new Date(),
  });

  // A hotel that is waiting for review.
  pendingHotel = await Hotel.create({
    name: "Pending Dunes Lodge",
    address: "3 Sand Street",
    city: "Dubai",
    contact: "+97150000002",
    owner: OWNER,
    approvalStatus: "pending",
  });

  // Stays pending for the whole suite.
  unapprovedHotel = await Hotel.create({
    name: "Never Reviewed Hotel",
    address: "7 Review Road",
    city: "Dubai",
    contact: "+97150000003",
    owner: OWNER,
    approvalStatus: "pending",
  });

  // A hotel that predates the approval workflow (no approvalStatus at all).
  legacyHotel = await Hotel.create({
    name: "Legacy Urbanza Suites",
    address: "Main Road 123",
    city: "New York",
    contact: "+0123456789",
    owner: OWNER,
  });

  roomInApprovedHotel = await Room.create({
    hotel: approvedHotel._id,
    roomType: "Double Bed",
    pricePerNight: 300,
    amenities: ["Free WiFi"],
    images: [],
    isAvailable: true,
  });

  // A legacy room: no capacity, no imageIds.
  await Room.create({
    hotel: legacyHotel._id,
    roomType: "Single Bed",
    pricePerNight: 150,
    amenities: ["Room Service"],
    images: ["https://example.com/legacy.jpg"],
    isAvailable: true,
  });
});

test.after(async () => {
  await mongoose.connection.close();
});

// ---------------------------------------------------------------------------
// 1. Permissions
// ---------------------------------------------------------------------------

test("role middleware rejects customers, owners and unknown users", async () => {
  const customerRes = mockRes();
  let nextCalled = false;
  await isAdmin({ user: { role: "user" } }, customerRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(customerRes.statusCode, 403);

  const ownerRes = mockRes();
  await isAdmin({ user: { role: "hotelOwner" } }, ownerRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(ownerRes.statusCode, 403);

  const adminRes = mockRes();
  let adminPassed = false;
  await isAdmin({ user: { role: "admin" } }, adminRes, () => {
    adminPassed = true;
  });
  assert.equal(adminPassed, true);
  assert.equal(adminRes.statusCode, 200);
});

test("isOwner allows hotel owners and admins but not customers", async () => {
  const res = mockRes();
  let passed = false;
  await isOwner({ user: { role: "hotelOwner" } }, res, () => {
    passed = true;
  });
  assert.equal(passed, true);

  const adminRes = mockRes();
  let adminPassed = false;
  await isOwner({ user: { role: "admin" } }, adminRes, () => {
    adminPassed = true;
  });
  assert.equal(adminPassed, true);

  const customerRes = mockRes();
  let customerPassed = false;
  await isOwner({ user: { role: "user" } }, customerRes, () => {
    customerPassed = true;
  });
  assert.equal(customerPassed, false);
  assert.equal(customerRes.statusCode, 403);
});

test("protected endpoints answer 401 without a session token", async () => {
  const res = mockRes();
  let error = null;
  await protect({ headers: {} }, res, (err) => {
    error = err;
  });
  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /not authorized/i);
});

// ---------------------------------------------------------------------------
// 2. Hotel creation + ownership
// ---------------------------------------------------------------------------

test("an owner can create a hotel; it is pending and owned by the session user", async () => {
  const result = await call(hotelController.createHotel, {
    user: { _id: OWNER, role: "hotelOwner" },
    body: {
      name: "Sunrise Residency",
      description: "A boutique stay near the old town.",
      category: "Boutique Hotel",
      address: "44 Rose Street",
      city: "London",
      state: "England",
      country: "United Kingdom",
      postalCode: "EC1V",
      latitude: 51.5237,
      longitude: -0.1585,
      contact: "+442070000000",
      contactEmail: "hello@sunriseresidency.example.com",
      amenities: ["Free WiFi", "Free Breakfast"],
      checkInTime: "3:00 PM",
      checkOutTime: "12:00 PM",
    },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.hotel.approvalStatus, "pending");
  assert.equal(result.body.hotel.owner, OWNER);
  assert.equal(result.body.hotel.city, "London");
});

test("the client cannot spoof the owner or the approval status", async () => {
  const result = await call(hotelController.createHotel, {
    user: { _id: OWNER_B, role: "hotelOwner" },
    body: {
      name: "Spoof Attempt Inn",
      address: "1 Fake Street",
      city: "Dubai",
      contact: "+971000",
      owner: OWNER,
      approvalStatus: "approved",
    },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.hotel.owner, OWNER_B);
  assert.equal(result.body.hotel.approvalStatus, "pending");
});

test("invalid hotel payloads are rejected with field details", async () => {
  const result = await call(hotelController.createHotel, {
    user: { _id: OWNER, role: "hotelOwner" },
    body: { name: "", address: "x", city: "", contact: "" },
  });

  assert.equal(result.status, 400);
  assert.ok(result.error.details.name);
  assert.ok(result.error.details.city);
  assert.ok(result.error.details.contact);
});

test("invalid coordinates are rejected", async () => {
  const result = await call(hotelController.createHotel, {
    user: { _id: OWNER, role: "hotelOwner" },
    body: {
      name: "Bad Coords Hotel",
      address: "1 Nowhere",
      city: "Dubai",
      contact: "+971000",
      latitude: 999,
      longitude: 10,
    },
  });

  assert.equal(result.status, 400);
  assert.ok(result.error.details.latitude);
});

test("the first listing promotes a customer to hotelOwner", async () => {
  const result = await call(hotelController.createHotel, {
    user: { _id: CUSTOMER, role: "user" },
    body: { name: "New Owner Hotel", address: "2 Nova Road", city: "Dubai", contact: "+971111" },
  });

  assert.equal(result.status, 201);
  const user = await User.findById(CUSTOMER);
  assert.equal(user.role, "hotelOwner");
});

// ---------------------------------------------------------------------------
// 3. Approval workflow + public exposure
// ---------------------------------------------------------------------------

test("public search only returns approved listings", async () => {
  const result = await call(hotelController.getHotels, { query: {} });
  assert.equal(result.status, 200);

  const names = result.body.hotels.map((hotel) => hotel.name);
  assert.ok(names.includes("Harbour View Resort"));
  assert.ok(names.includes("Legacy Urbanza Suites"), "legacy listings stay visible");
  assert.ok(!names.includes("Pending Dunes Lodge"));
  assert.ok(!names.includes("Spoof Attempt Inn"));
});

test("public search supports city, category, amenity and price filters", async () => {
  const byCity = await call(hotelController.getHotels, { query: { city: "Singapore" } });
  assert.equal(byCity.body.hotels.length, 1);
  assert.equal(byCity.body.hotels[0].name, "Harbour View Resort");

  const byCategory = await call(hotelController.getHotels, { query: { category: "Resort" } });
  assert.equal(byCategory.body.hotels.length, 1);

  const byAmenity = await call(hotelController.getHotels, {
    query: { amenities: "Free WiFi,Pool Access" },
  });
  assert.equal(byCity.status, 200);
  assert.ok(byAmenity.body.hotels.some((hotel) => hotel.name === "Harbour View Resort"));
  assert.ok(!byAmenity.body.hotels.some((hotel) => hotel.name === "Legacy Urbanza Suites"));

  const byPrice = await call(hotelController.getHotels, { query: { minPrice: "1000" } });
  assert.equal(byPrice.body.hotels.length, 0);

  const sorted = await call(hotelController.getHotels, { query: { sort: "price_asc" } });
  const prices = sorted.body.hotels.map((hotel) => hotel.minPrice ?? Infinity);
  const ordered = [...prices].sort((a, b) => a - b);
  assert.deepEqual(prices, ordered);
});

test("a pending hotel is hidden from customers but visible to its owner", async () => {
  const asCustomer = await call(hotelController.getHotelById, {
    params: { id: pendingHotel._id.toString() },
    query: {},
    user: { _id: CUSTOMER, role: "hotelOwner" },
  });
  assert.equal(asCustomer.status, 404);

  const asOwner = await call(hotelController.getHotelById, {
    params: { id: pendingHotel._id.toString() },
    query: {},
    user: { _id: OWNER, role: "hotelOwner" },
  });
  assert.equal(asOwner.status, 200);
  assert.equal(asOwner.body.hotel.name, "Pending Dunes Lodge");

  const asAdmin = await call(hotelController.getHotelById, {
    params: { id: pendingHotel._id.toString() },
    query: {},
    user: { _id: ADMIN, role: "admin" },
  });
  assert.equal(asAdmin.status, 200);
});

test("an admin can approve and reject a listing", async () => {
  const approve = await call(hotelController.approveHotel, {
    params: { id: pendingHotel._id.toString() },
    user: { _id: ADMIN, role: "admin" },
    body: {},
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.body.hotel.approvalStatus, "approved");
  assert.equal(approve.body.hotel.approvedBy, ADMIN);

  const reject = await call(hotelController.rejectHotel, {
    params: { id: pendingHotel._id.toString() },
    user: { _id: ADMIN, role: "admin" },
    body: { reason: "Please add the missing floor plans." },
  });
  assert.equal(reject.status, 200);
  assert.equal(reject.body.hotel.approvalStatus, "rejected");
  assert.equal(reject.body.hotel.rejectionReason, "Please add the missing floor plans.");

  // A rejection without a reason is rejected.
  const noReason = await call(hotelController.rejectHotel, {
    params: { id: pendingHotel._id.toString() },
    user: { _id: ADMIN, role: "admin" },
    body: {},
  });
  assert.equal(noReason.status, 400);

  // Put it back into review.
  await call(hotelController.approveHotel, {
    params: { id: pendingHotel._id.toString() },
    user: { _id: ADMIN, role: "admin" },
    body: {},
  });
});

test("the admin dashboard lists every hotel with its owner and status", async () => {
  const result = await call(hotelController.getAdminHotels, {
    query: {},
    user: { _id: ADMIN, role: "admin" },
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.hotels.length >= 3);
  assert.ok(result.body.hotels.every((hotel) => hotel.owner));
  assert.ok(result.body.counts.approved >= 2);
});

// ---------------------------------------------------------------------------
// 4. Ownership on update / delete
// ---------------------------------------------------------------------------

test("an owner can only edit their own hotel", async () => {
  const forbidden = await call(hotelController.updateHotel, {
    params: { id: approvedHotel._id.toString() },
    user: { _id: OWNER_B, role: "hotelOwner" },
    body: { name: "Hijacked" },
  });
  assert.equal(forbidden.status, 403);

  const allowed = await call(hotelController.updateHotel, {
    params: { id: approvedHotel._id.toString() },
    user: { _id: OWNER, role: "hotelOwner" },
    body: { description: "A freshly updated description." },
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.hotel.description, "A freshly updated description.");
});

test("a material owner edit sends the listing back for review", async () => {
  // The previous test already moved the listing into review, so it is
  // approved again first to prove the transition.
  await call(hotelController.approveHotel, {
    params: { id: approvedHotel._id.toString() },
    user: { _id: ADMIN, role: "admin" },
    body: {},
  });

  const result = await call(hotelController.updateHotel, {
    params: { id: approvedHotel._id.toString() },
    user: { _id: OWNER, role: "hotelOwner" },
    body: { city: "Sentosa" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.hotel.approvalStatus, "pending");
  assert.match(result.body.message, /pending review/i);

  // Re-approve for the remaining tests.
  await call(hotelController.approveHotel, {
    params: { id: approvedHotel._id.toString() },
    user: { _id: ADMIN, role: "admin" },
    body: {},
  });
});

test("an admin edit does not trigger a re-review", async () => {
  const result = await call(hotelController.updateHotel, {
    params: { id: approvedHotel._id.toString() },
    user: { _id: ADMIN, role: "admin" },
    body: { description: "Admin edited description." },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.hotel.approvalStatus, "approved");
});

test("a hotel with active bookings cannot be deleted without force", async () => {
  // A dedicated listing so the shared fixtures stay intact.
  const temp = await Hotel.create({
    name: "Temporary Deletion Target",
    address: "99 Throwaway Lane",
    city: "Dubai",
    contact: "+9710009999",
    owner: OWNER,
    approvalStatus: "approved",
  });
  const tempRoom = await Room.create({
    hotel: temp._id,
    roomType: "Studio",
    pricePerNight: 90,
    amenities: [],
    images: [],
    isAvailable: true,
  });
  const tempBooking = await Booking.create({
    user: CUSTOMER,
    room: tempRoom._id,
    hotel: temp._id,
    checkInDate: new Date(Date.UTC(2030, 0, 5)),
    checkOutDate: new Date(Date.UTC(2030, 0, 7)),
    totalPrice: 180,
    guests: 1,
    status: "confirmed",
  });
  await BookingSlot.create({
    room: tempRoom._id,
    hotel: temp._id,
    booking: tempBooking._id,
    date: new Date(Date.UTC(2030, 0, 5)),
  });

  const blocked = await call(hotelController.deleteHotel, {
    params: { id: temp._id.toString() },
    query: {},
    user: { _id: ADMIN, role: "admin" },
  });
  assert.equal(blocked.status, 409);
  assert.match(blocked.error.message, /active booking/i);

  // An owner may not force the deletion either.
  const ownerForce = await call(hotelController.deleteHotel, {
    params: { id: temp._id.toString() },
    query: { force: "true" },
    user: { _id: OWNER, role: "hotelOwner" },
  });
  assert.equal(ownerForce.status, 409);

  const forced = await call(hotelController.deleteHotel, {
    params: { id: temp._id.toString() },
    query: { force: "true" },
    user: { _id: ADMIN, role: "admin" },
  });
  assert.equal(forced.status, 200);
  assert.equal(await Hotel.countDocuments({ _id: temp._id }), 0);
  assert.equal(await Room.countDocuments({ hotel: temp._id }), 0);
  assert.equal(await BookingSlot.countDocuments({ hotel: temp._id }), 0);
});

// ---------------------------------------------------------------------------
// 5. Rooms and hotel association
// ---------------------------------------------------------------------------

test("a room is always attached to a hotel the owner controls", async () => {
  const forbidden = await call(roomController.addRoom, {
    user: { _id: OWNER_B, role: "hotelOwner" },
    body: { hotelId: approvedHotel._id.toString(), roomType: "Suite", pricePerNight: 500 },
    files: [],
  });
  assert.equal(forbidden.status, 403);

  const created = await call(roomController.addRoom, {
    user: { _id: OWNER, role: "hotelOwner" },
    body: {
      hotelId: approvedHotel._id.toString(),
      roomType: "Suite",
      pricePerNight: 500,
      capacity: 3,
      amenities: JSON.stringify(["Free WiFi", "Gym"]),
      description: "A suite with a sea view.",
    },
    files: [],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.room.hotel.toString(), approvedHotel._id.toString());
  assert.equal(created.body.room.capacity, 3);
  assert.deepEqual(created.body.room.amenities, ["Free WiFi", "Gym"]);
  assert.equal(created.body.hotel.name, approvedHotel.name);
});

test("invalid room payloads are rejected", async () => {
  const badType = await call(roomController.addRoom, {
    user: { _id: OWNER, role: "hotelOwner" },
    body: { hotelId: approvedHotel._id.toString(), roomType: "Penthouse", pricePerNight: 100 },
    files: [],
  });
  assert.equal(badType.status, 400);

  const badPrice = await call(roomController.addRoom, {
    user: { _id: OWNER, role: "hotelOwner" },
    body: { hotelId: approvedHotel._id.toString(), roomType: "Suite", pricePerNight: -5 },
    files: [],
  });
  assert.equal(badPrice.status, 400);
});

test("the hotel detail page returns the hotel rooms grouped by type", async () => {
  const result = await call(hotelController.getHotelById, {
    params: { id: approvedHotel._id.toString() },
    query: {},
    user: { _id: CUSTOMER, role: "user" },
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.rooms.length >= 2);
  assert.ok(result.body.roomTypes.length >= 1);

  const doubleBed = result.body.roomTypes.find((type) => type.roomType === "Double Bed");
  assert.ok(doubleBed);
  assert.equal(doubleBed.total, 1);
  assert.equal(doubleBed.available, 1);
  assert.equal(doubleBed.pricePerNight, 300);
});

test("the owner room list spans every hotel of the owner", async () => {
  const result = await call(roomController.getMyRooms, {
    query: {},
    user: { _id: OWNER, role: "hotelOwner" },
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.rooms.length >= 3);
  assert.ok(result.body.rooms.every((room) => room.hotel));
});

test("public room search hides rooms of unapproved hotels", async () => {
  const pendingRoom = await Room.create({
    hotel: unapprovedHotel._id,
    roomType: "Suite",
    pricePerNight: 999,
    amenities: [],
    images: [],
    isAvailable: true,
  });

  const result = await call(roomController.getRooms, { query: {} });
  assert.equal(result.status, 200);
  assert.ok(!result.body.rooms.some((room) => room._id.toString() === pendingRoom._id.toString()));

  await Room.deleteOne({ _id: pendingRoom._id });
});

// ---------------------------------------------------------------------------
// 6. Booking
// ---------------------------------------------------------------------------

test("a customer can book an available room", async () => {
  const result = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(10),
      checkOutDate: iso(12),
      guests: 2,
      paymentMethod: "Pay At Hotel",
    },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.booking.totalPrice, 600);
  assert.equal(result.body.booking.hotel.toString(), approvedHotel._id.toString());
  assert.equal(result.body.booking.status, "pending");
  assert.equal(result.body.booking.isPaid, false);

  // Two nights are locked.
  const slots = await BookingSlot.find({ booking: result.body.booking._id });
  assert.equal(slots.length, 2);
});

test("the same room cannot be booked twice for overlapping dates", async () => {
  const first = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(20),
      checkOutDate: iso(22),
      guests: 1,
    },
  });
  assert.equal(first.status, 201);

  const overlap = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(21),
      checkOutDate: iso(23),
      guests: 1,
    },
  });
  assert.equal(overlap.status, 409);

  const sameRange = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(20),
      checkOutDate: iso(22),
      guests: 1,
    },
  });
  assert.equal(sameRange.status, 409);
});

test("concurrent booking requests can never oversell a room", async () => {
  const room = await Room.create({
    hotel: approvedHotel._id,
    roomType: "Studio",
    pricePerNight: 120,
    amenities: [],
    images: [],
    isAvailable: true,
  });

  const attempts = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      call(bookingController.createBooking, {
        userId: index % 2 === 0 ? CUSTOMER : OWNER_B,
        body: {
          roomId: room._id.toString(),
          checkInDate: iso(30),
          checkOutDate: iso(32),
          guests: 1,
        },
      })
    )
  );

  const created = attempts.filter((attempt) => attempt.status === 201);
  const rejected = attempts.filter((attempt) => attempt.status === 409);
  assert.equal(created.length, 1, "exactly one booking may win the room");
  assert.equal(rejected.length, 7);

  const slots = await BookingSlot.find({ room: room._id });
  assert.equal(slots.length, 2);

  await BookingSlot.deleteMany({ room: room._id });
  await Booking.deleteMany({ room: room._id });
  await Room.deleteOne({ _id: room._id });
});

test("cancelling a booking releases the inventory again", async () => {
  const created = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(40),
      checkOutDate: iso(41),
      guests: 1,
    },
  });
  assert.equal(created.status, 201);

  const bookingId = created.body.booking._id;
  assert.equal(await BookingSlot.countDocuments({ booking: bookingId }), 1);

  const cancelled = await call(bookingController.cancelBooking, {
    params: { bookingId: bookingId.toString() },
    userId: CUSTOMER,
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.booking.status, "cancelled");
  assert.equal(await BookingSlot.countDocuments({ booking: bookingId }), 0);

  // The room is bookable again.
  const again = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(40),
      checkOutDate: iso(41),
      guests: 1,
    },
  });
  assert.equal(again.status, 201);
});

test("a user cannot cancel somebody else's booking", async () => {
  const created = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(50),
      checkOutDate: iso(51),
      guests: 1,
    },
  });
  const bookingId = created.body.booking._id;

  const denied = await call(bookingController.cancelBooking, {
    params: { bookingId: bookingId.toString() },
    userId: OWNER_B,
  });
  assert.equal(denied.status, 403);
});

test("invalid booking input is rejected before anything is written", async () => {
  const before = await Booking.countDocuments({});

  const noDates = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: { roomId: roomInApprovedHotel._id.toString(), guests: 1 },
  });
  assert.equal(noDates.status, 400);

  const reversed = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(60),
      checkOutDate: iso(59),
      guests: 1,
    },
  });
  assert.equal(reversed.status, 400);

  const past = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(-5),
      checkOutDate: iso(-3),
      guests: 1,
    },
  });
  assert.equal(past.status, 400);

  const badRoom = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: "not-an-id",
      checkInDate: iso(60),
      checkOutDate: iso(61),
      guests: 1,
    },
  });
  assert.equal(badRoom.status, 400);

  const tooManyGuests = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(60),
      checkOutDate: iso(61),
      guests: 99,
    },
  });
  assert.equal(tooManyGuests.status, 400);

  const overCapacity = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(60),
      checkOutDate: iso(61),
      guests: 2,
    },
  });
  // The seeded double room has the default capacity of 2 -> two guests fit.
  assert.equal(overCapacity.status, 201);

  assert.equal(await Booking.countDocuments({}), before + 1);
});

test("a room of an unapproved hotel cannot be booked", async () => {
  const pendingRoom = await Room.create({
    hotel: unapprovedHotel._id,
    roomType: "Suite",
    pricePerNight: 999,
    amenities: [],
    images: [],
    isAvailable: true,
  });

  const result = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: pendingRoom._id.toString(),
      checkInDate: iso(70),
      checkOutDate: iso(71),
      guests: 1,
    },
  });
  assert.equal(result.status, 403);

  await Room.deleteOne({ _id: pendingRoom._id });
});

test("availability reflects the bookings of the selected nights", async () => {
  const check = await call(roomController.checkRoomAvailability, {
    params: { roomId: roomInApprovedHotel._id.toString() },
    query: { checkIn: iso(80), checkOut: iso(82) },
  });
  assert.equal(check.status, 200);
  assert.equal(check.body.available, true);

  await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: roomInApprovedHotel._id.toString(),
      checkInDate: iso(80),
      checkOutDate: iso(82),
      guests: 1,
    },
  });

  const after = await call(roomController.checkRoomAvailability, {
    params: { roomId: roomInApprovedHotel._id.toString() },
    query: { checkIn: iso(80), checkOut: iso(82) },
  });
  assert.equal(after.body.available, false);
});

// ---------------------------------------------------------------------------
// 7. Backwards compatibility
// ---------------------------------------------------------------------------

test("legacy rooms and bookings stay usable", async () => {
  const legacyRoom = await Room.findOne({ hotel: legacyHotel._id });
  assert.ok(legacyRoom);
  // Rooms created before the field existed fall back to the schema default.
  assert.equal(legacyRoom.capacity, 2);
  assert.deepEqual(legacyRoom.amenities, ["Room Service"]);
  assert.deepEqual(legacyRoom.images, ["https://example.com/legacy.jpg"]);

  // Booking it works and the room keeps its legacy data.
  const result = await call(bookingController.createBooking, {
    userId: CUSTOMER,
    body: {
      roomId: legacyRoom._id.toString(),
      checkInDate: iso(90),
      checkOutDate: iso(91),
      guests: 1,
    },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.booking.hotel.toString(), legacyHotel._id.toString());

  // The legacy listing is still publicly visible.
  const publicList = await call(hotelController.getHotels, { query: { city: "New York" } });
  assert.equal(publicList.body.hotels.length, 1);
  assert.equal(publicList.body.hotels[0].name, "Legacy Urbanza Suites");

  // And its legacy room is still returned by the public room search.
  const rooms = await call(roomController.getRooms, { query: { city: "New York" } });
  assert.equal(rooms.body.rooms.length, 1);
  assert.equal(rooms.body.rooms[0]._id.toString(), legacyRoom._id.toString());
});

test("the owner dashboard aggregates every hotel of the owner", async () => {
  const result = await call(bookingController.getOwnerDashboard, {
    query: {},
    user: { _id: OWNER, role: "hotelOwner" },
    userId: OWNER,
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.hotels.length >= 2);
  assert.ok(result.body.totalBookings >= 1);
});

test("coordinates are stored as scalars and as a GeoJSON point", async () => {
  const hotel = await Hotel.findById(approvedHotel._id);
  assert.equal(typeof hotel.latitude, "number");
  assert.equal(typeof hotel.longitude, "number");
  assert.ok(hotel.location);
  assert.equal(hotel.location.type, "Point");
  // GeoJSON order is [longitude, latitude].
  assert.deepEqual(hotel.location.coordinates, [hotel.longitude, hotel.latitude]);
});
