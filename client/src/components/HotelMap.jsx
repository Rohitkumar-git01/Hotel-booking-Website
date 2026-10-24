import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { TILE_URL, TILE_ATTRIBUTION, markerIcon, getDirectionsUrl } from "../utils/map";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "../constants/hotels";
// Reuse the existing location icon asset for the directions link.
import locationPinIcon from "../assets/locationIcon.svg";

/**
 * Read-only map for the hotel details page.
 * Shows where the hotel is and links to a directions application.
 */
const HotelMap = ({ latitude, longitude, name, address, className = "" }) => {
  const [mapError, setMapError] = useState(null);

  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const position = hasCoordinates ? [latitude, longitude] : DEFAULT_MAP_CENTER;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="h-72 w-full rounded-xl overflow-hidden border border-gray-300">
        <MapContainer
          center={position}
          zoom={hasCoordinates ? DEFAULT_MAP_ZOOM : 3}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url={TILE_URL}
            attribution={TILE_ATTRIBUTION}
            eventHandlers={{
              tileerror: () => setMapError("The map could not be loaded."),
            }}
          />
          {hasCoordinates && (
            <Marker position={position} icon={markerIcon}>
              <Popup>
                <strong>{name || "Hotel"}</strong>
                <br />
                {address}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {mapError && <p className="text-sm text-amber-700">{mapError}</p>}

      {hasCoordinates ? (
        <a
          href={getDirectionsUrl(latitude, longitude)}
          target="_blank"
          rel="noreferrer"
          className="self-start inline-flex items-center gap-2 text-primary hover:text-primary-dull transition-all"
        >
          <img src={locationPinIcon} alt="" className="w-4 h-4" />
          Get directions
        </a>
      ) : (
        <p className="text-sm text-gray-500">
          This hotel has no exact coordinates yet. Contact the property for directions.
        </p>
      )}
    </div>
  );
};

export default HotelMap;
