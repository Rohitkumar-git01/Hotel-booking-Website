import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    image: { type: String, default: "" },
    // "user"       -> customer
    // "hotelOwner" -> can list and manage hotels/rooms
    // "admin"      -> can approve listings and manage every hotel
    role: { type: String, enum: ["user", "hotelOwner", "admin"], default: "user" },
    recentSearchedCities: [{ type: String }],
  },
  { timestamps: true, _id: false }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
