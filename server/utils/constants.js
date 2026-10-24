// ---------------------------------------------------------------------------
// Shared domain constants for the QuickStay multi-hotel system.
//
// These live on the server so that validation, query building and API
// responses can never drift apart. The client keeps a mirrored copy in
// `client/src/constants/hotels.js` for dropdowns and filter chips.
// ---------------------------------------------------------------------------

export const HOTEL_CATEGORIES = [
  "Hotel",
  "Apartment",
  "Resort",
  "Villa",
  "Homestay",
  "Boutique Hotel",
  "Hostel",
  "Guest House",
  "Cottage",
  "Serviced Apartment",
];

export const HOTEL_AMENITIES = [
  "Free WiFi",
  "Free Breakfast",
  "Pool Access",
  "Room Service",
  "Mountain View",
  "Gym",
  "Spa",
  "Free Parking",
  "Airport Shuttle",
  "Restaurant",
  "Bar",
  "Pet Friendly",
  "Air Conditioning",
  "Laundry",
  "24/7 Front Desk",
  "Wheelchair Accessible",
  "Business Centre",
  "Family Friendly",
  "Sea View",
  "City View",
];

// Mirrors the `roomType` enum on the Room model. Kept here so the room
// controller can validate incoming payloads before hitting Mongoose.
export const ROOM_TYPES = [
  "Single Bed",
  "Double Bed",
  "Luxury Room",
  "Family Room",
  "Suite",
  "Studio",
  "Twin Bed",
  "Deluxe Room",
];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"];

export const PAYMENT_METHODS = [
  "Stripe",
  "Card",
  "Net Banking",
  "PhonePe",
  "Google Pay",
  "Paytm",
  "Pay At Hotel",
];

export const PAY_AT_HOTEL = "Pay At Hotel";

// Sort options exposed by the public hotel search endpoint.
export const HOTEL_SORT_OPTIONS = [
  "price_asc",
  "price_desc",
  "rating",
  "name_asc",
  "name_desc",
  "newest",
];

export const MAX_HOTEL_IMAGES = 10;
export const MAX_ROOM_IMAGES = 6;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;
