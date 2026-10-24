import L from "leaflet";

// ---------------------------------------------------------------------------
// Shared map configuration.
//
// OpenStreetMap standard tiles are used by default. Both the tile URL and the
// attribution can be replaced through environment variables so a production
// deployment can point at a commercial tile provider without a code change.
//
// The attribution is required by the OpenStreetMap tile usage policy and must
// stay visible on every map.
// ---------------------------------------------------------------------------

export const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// A plain div icon avoids the well known "missing marker image" problem with
// bundlers, which cannot resolve Leaflet's default icon URLs.
export const markerIcon = L.divIcon({
  className: "quickstay-marker",
  html: '<div class="quickstay-marker__dot"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

/** Opens the coordinates in the default map application of the device. */
export const getDirectionsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
