import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Inventory locks.
//
// Each document reserves a single room for a single night. The unique index
// on { room, date } is what makes concurrent booking requests safe: two
// requests racing for the same night cannot both insert, so a room can never
// be oversold regardless of how many serverless instances are running.
//
// A booking that spans N nights inserts N slot documents. Cancelling a
// booking deletes its slots again, returning the inventory to the pool.
// ---------------------------------------------------------------------------
const bookingSlotSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    // UTC midnight of the night this slot reserves.
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

bookingSlotSchema.index({ room: 1, date: 1 }, { unique: true });
bookingSlotSchema.index({ booking: 1 });
bookingSlotSchema.index({ hotel: 1, date: 1 });

const BookingSlot =
  mongoose.models.BookingSlot || mongoose.model("BookingSlot", bookingSlotSchema);

export default BookingSlot;
