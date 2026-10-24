// ---------------------------------------------------------------------------
// Hotel domain constants for the frontend.
//
// Mirrors `server/utils/constants.js`. The server always validates against
// its own copy, so a mismatch can never break the API - it only affects
// which options are offered in the UI.
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

export const HOTEL_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

export const APPROVAL_STATUS_META = {
  pending: {
    label: "Pending review",
    badge: "bg-amber-100 text-amber-700",
    description: "Waiting for an admin to review this listing.",
  },
  approved: {
    label: "Approved",
    badge: "bg-green-100 text-green-700",
    description: "Live and visible to customers.",
  },
  rejected: {
    label: "Rejected",
    badge: "bg-red-100 text-red-700",
    description: "Changes are needed before this listing can go live.",
  },
};

export const getApprovalMeta = (status) =>
  APPROVAL_STATUS_META[status] || {
    label: "Unreviewed",
    badge: "bg-gray-100 text-gray-700",
    description: "This listing was created before the approval workflow.",
  };

// Default map position (London) used until a location is picked.
export const DEFAULT_MAP_CENTER = [51.505, -0.09];
export const DEFAULT_MAP_ZOOM = 12;

export const toDateInputValue = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
};

export const formatCurrency = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : "—";
