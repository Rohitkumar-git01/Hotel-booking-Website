import { HttpError } from "./httpError.js";

// ---------------------------------------------------------------------------
// Geocoding proxy for OpenStreetMap Nominatim.
//
// The browser never talks to Nominatim directly: requests are proxied through
// the backend so that
//   * a descriptive User-Agent / Referer is sent (Nominatim usage policy),
//   * the 1 request/second policy is enforced server side,
//   * and no provider configuration leaks into the frontend bundle.
// ---------------------------------------------------------------------------

const NOMINATIM_BASE = process.env.GEOCODER_BASE_URL || "https://nominatim.openstreetmap.org";

const userAgent = () =>
  process.env.GEOCODER_USER_AGENT ||
  process.env.GEOCODER_CONTACT ||
  "QuickStay/1.0 (hotel booking platform)";

const buildHeaders = () => ({
  "User-Agent": userAgent(),
  Accept: "application/json",
  ...(process.env.GEOCODER_CONTACT
    ? { Referer: `https://${process.env.GEOCODER_CONTACT.replace(/^https?:\/\//, "")}` }
    : {}),
});

const request = async (path, params) => {
  const url = new URL(path, NOMINATIM_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  let response;
  try {
    response = await fetch(url, { headers: buildHeaders() });
  } catch (error) {
    throw new HttpError(502, "Location search is temporarily unavailable. Please try again.");
  }

  if (response.status === 429) {
    throw new HttpError(429, "Location search is rate limited. Please wait a moment and try again.");
  }
  if (!response.ok) {
    throw new HttpError(502, "Location search is temporarily unavailable. Please try again.");
  }

  return response.json();
};

/**
 * Forward geocoding: free-text address -> list of candidates.
 */
export const geocodeAddress = async (query, { limit = 5 } = {}) => {
  const trimmed = String(query || "").trim();
  if (trimmed.length < 3) {
    throw new HttpError(400, "Enter at least 3 characters to search for a location.");
  }

  const data = await request("/search", {
    q: trimmed,
    format: "jsonv2",
    addressdetails: 1,
    limit: Math.min(Number(limit) || 5, 10),
  });

  if (!Array.isArray(data)) return [];

  return data.map((item) => ({
    label: item.display_name,
    // GeoJSON order is [longitude, latitude].
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    geojson: { type: "Point", coordinates: [Number(item.lon), Number(item.lat)] },
    address: item.address || {},
  }));
};

/**
 * Reverse geocoding: coordinates -> human readable address.
 */
export const reverseGeocode = async (latitude, longitude) => {
  const data = await request("/reverse", {
    lat: latitude,
    lon: longitude,
    format: "jsonv2",
    addressdetails: 1,
  });

  if (!data || data.error) {
    throw new HttpError(404, "No address found for this location.");
  }

  return {
    label: data.display_name,
    latitude: Number(data.lat),
    longitude: Number(data.lon),
    geojson: { type: "Point", coordinates: [Number(data.lon), Number(data.lat)] },
    address: data.address || {},
  };
};
