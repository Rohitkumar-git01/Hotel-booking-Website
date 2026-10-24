// ---------------------------------------------------------------------------
// QuickStay data migration.
//
// Run with:  npm run migrate            (applies the changes)
//            npm run migrate -- --dry-run   (only reports what would change)
//
// What it does
//   1. Backfills `approvalStatus: "approved"` on hotels that were created
//      before the approval workflow existed. Those listings were publicly
//      visible before, so they must stay visible. New listings are always
//      created with "pending".
//   2. Backfills the GeoJSON `location` point for hotels that already have
//      latitude/longitude but no `location` field.
//   3. Backfills `capacity` on rooms that predate the field.
//   4. Backfills the inventory locks (BookingSlot) for every existing
//      non-cancelled booking, so the new oversell protection also covers
//      bookings that were made before the migration.
//   5. Creates the indexes the new features rely on (the unique
//      { room, date } index in particular).
//
// The script is idempotent: running it twice does not change anything twice.
// ---------------------------------------------------------------------------

process.env.SKIP_SEED = "1";

const DRY_RUN = process.argv.includes("--dry-run");

const run = async () => {
  const { default: connectDB } = await import("../configs/db.js");
  const { default: mongoose } = await import("mongoose");
  const { default: Hotel } = await import("../models/Hotel.js");
  const { default: Room } = await import("../models/Room.js");
  const { default: Booking } = await import("../models/Booking.js");
  const { default: BookingSlot } = await import("../models/BookingSlot.js");

  await connectDB();

  const summary = {
    hotelsApproved: 0,
    locationsBackfilled: 0,
    roomsCapacityBackfilled: 0,
    slotsCreated: 0,
    slotsSkipped: 0,
  };

  // --- 1 + 2. Hotels -----------------------------------------------------
  const legacyHotels = await Hotel.find({
    $or: [
      { approvalStatus: { $exists: false } },
      { approvalStatus: null },
    ],
  });

  for (const hotel of legacyHotels) {
    const needsLocation =
      typeof hotel.latitude === "number" &&
      typeof hotel.longitude === "number" &&
      !hotel.location;

    if (DRY_RUN) {
      summary.hotelsApproved += 1;
      if (needsLocation) summary.locationsBackfilled += 1;
      continue;
    }

    hotel.approvalStatus = "approved";
    if (needsLocation) {
      hotel.location = { type: "Point", coordinates: [hotel.longitude, hotel.latitude] };
      summary.locationsBackfilled += 1;
    }
    await hotel.save();
    summary.hotelsApproved += 1;
  }

  // --- 3. Rooms ----------------------------------------------------------
  const roomsWithoutCapacity = await Room.find({ capacity: { $exists: false } });
  if (!DRY_RUN) {
    await Room.updateMany({ capacity: { $exists: false } }, { $set: { capacity: 2 } });
  }
  summary.roomsCapacityBackfilled = roomsWithoutCapacity.length;

  // --- 4. Inventory locks for existing bookings -------------------------
  const bookings = await Booking.find({ status: { $ne: "cancelled" } });

  for (const booking of bookings) {
    const start = new Date(booking.checkInDate);
    const end = new Date(booking.checkOutDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      summary.slotsSkipped += 1;
      continue;
    }

    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const firstNight = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    );

    const slotDocs = [];
    for (let index = 0; index < nights; index += 1) {
      slotDocs.push({
        room: booking.room,
        hotel: booking.hotel,
        booking: booking._id,
        date: new Date(firstNight.getTime() + index * (1000 * 60 * 60 * 24)),
      });
    }

    if (DRY_RUN) {
      summary.slotsCreated += slotDocs.length;
      continue;
    }

    try {
      await BookingSlot.insertMany(slotDocs, { ordered: false });
      summary.slotsCreated += slotDocs.length;
    } catch (error) {
      if (error?.code === 11000) {
        // Some nights are already locked - only the missing ones are added.
        const existing = await BookingSlot.find({
          booking: booking._id,
          date: { $in: slotDocs.map((slot) => slot.date) },
        }).distinct("date");
        const existingTimes = new Set(existing.map((date) => new Date(date).getTime()));
        const missing = slotDocs.filter((slot) => !existingTimes.has(new Date(slot.date).getTime()));
        if (missing.length) {
          await BookingSlot.insertMany(missing, { ordered: false });
        }
        summary.slotsCreated += missing.length;
        summary.slotsSkipped += slotDocs.length - missing.length;
      } else {
        throw error;
      }
    }
  }

  // --- 5. Indexes --------------------------------------------------------
  if (!DRY_RUN) {
    await BookingSlot.createIndexes();
    await Room.createIndexes();
    await Hotel.createIndexes();
  }

  console.log(`\n${DRY_RUN ? "[dry-run] " : ""}Migration summary:`);
  console.log(`  hotels marked as approved   : ${summary.hotelsApproved}`);
  console.log(`  hotel locations backfilled   : ${summary.locationsBackfilled}`);
  console.log(`  rooms with capacity set      : ${summary.roomsCapacityBackfilled}`);
  console.log(`  inventory locks created      : ${summary.slotsCreated}`);
  if (summary.slotsSkipped) {
    console.log(`  inventory locks skipped      : ${summary.slotsSkipped}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
