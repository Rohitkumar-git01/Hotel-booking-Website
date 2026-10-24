import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { TILE_URL, TILE_ATTRIBUTION, markerIcon } from "../../utils/map";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "../../constants/hotels";

/** Keeps the map centred on the selected coordinates. */
const Recentre = ({ position }) => {
  const map = useMap();
  const lat = position?.[0];
  const lng = position?.[1];

  useEffect(() => {
    if (typeof lat === "number" && typeof lng === "number") {
      map.setView([lat, lng], Math.max(map.getZoom(), DEFAULT_MAP_ZOOM));
    }
  }, [lat, lng, map]);

  return null;
};

/** Reports clicks on the map back to the parent. */
const ClickHandler = ({ onSelect }) => {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
};

/**
 * Interactive location picker for the hotel form.
 *
 * - search for an address (geocoded through the backend proxy)
 * - click the map to drop the marker
 * - drag the marker to fine tune the position
 * - shows the selected latitude/longitude
 */
const LocationPicker = ({
  latitude,
  longitude,
  onChange,
  onSearchAddress,
  onReverseGeocode,
  addressLabel = "",
  cityLabel = "",
  disabled = false,
}) => {
  const [position, setPosition] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [mapError, setMapError] = useState(null);

  // Sync the marker with the values that are already stored.
  useEffect(() => {
    if (typeof latitude === "number" && typeof longitude === "number") {
      setPosition([latitude, longitude]);
    } else {
      setPosition(null);
    }
  }, [latitude, longitude]);

  const handleSelect = (next) => {
    setPosition(next);
    onChange?.({ latitude: next[0], longitude: next[1] });
    // Ask the backend to resolve the address of the clicked point. The map
    // click itself never fills the address field on its own.
    onReverseGeocode?.(next[0], next[1]);
  };

  const handleDragEnd = (event) => {
    const { lat, lng } = event.target.getLatLng();
    handleSelect([lat, lng]);
  };

  const runSearch = async (query) => {
    const term = (query ?? searchTerm).trim();
    if (!term) return;
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const data = await onSearchAddress(term);
      const items = data?.results || [];
      setResults(items);
      if (!items.length) {
        setSearchError("No matching location found. Try a different search term.");
      }
    } catch (error) {
      setSearchError(error.message || "Location search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const mapCenter = useMemo(() => position || DEFAULT_MAP_CENTER, [position]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor="location-search" className="font-medium text-gray-700">
          Search for a location
        </label>
        <div className="flex gap-2">
          <input
            id="location-search"
            type="text"
            value={searchTerm}
            disabled={disabled}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder="e.g. Marine Drive, Singapore"
            className="border border-gray-300 rounded px-3 py-2 flex-1 outline-indigo-500 disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={() => runSearch()}
            disabled={disabled || searching}
            className="px-4 py-2 rounded bg-primary text-white text-sm hover:bg-primary-dull transition-all disabled:opacity-60 cursor-pointer"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {searchError && <p className="text-sm text-red-600">{searchError}</p>}

        {results.length > 0 && (
          <ul className="border border-gray-300 rounded divide-y divide-gray-200 max-h-56 overflow-y-auto">
            {results.map((result, index) => (
              <li key={`${result.latitude}-${result.longitude}-${index}`}>
                <button
                  type="button"
                  onClick={() => {
                    handleSelect([result.latitude, result.longitude]);
                    setResults([]);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {(addressLabel || cityLabel) && (
          <button
            type="button"
            onClick={() => runSearch([addressLabel, cityLabel].filter(Boolean).join(", "))}
            disabled={disabled || searching}
            className="self-start text-sm text-primary underline hover:text-primary-dull disabled:opacity-60 cursor-pointer"
          >
            Locate this address on the map
          </button>
        )}
      </div>

      <div className="relative">
        <div className="h-80 w-full rounded-xl overflow-hidden border border-gray-300">
          <MapContainer
            center={mapCenter}
            zoom={position ? DEFAULT_MAP_ZOOM : 3}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url={TILE_URL}
              attribution={TILE_ATTRIBUTION}
              eventHandlers={{
                tileerror: () => setMapError("Map tiles could not be loaded."),
              }}
            />
            <Recentre position={position} />
            {!disabled && <ClickHandler onSelect={handleSelect} />}
            {position && (
              <Marker
                position={position}
                icon={markerIcon}
                draggable={!disabled}
                eventHandlers={{ dragend: handleDragEnd }}
              >
                <Popup>
                  Selected location
                  <br />
                  {position[0].toFixed(5)}, {position[1].toFixed(5)}
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {mapError && (
          <p className="text-sm text-amber-700 mt-2">
            {mapError} The coordinates below are still accurate.
          </p>
        )}

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="latitude" className="font-medium text-gray-700">
              Latitude
            </label>
            <input
              id="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              readOnly={disabled}
              value={position ? position[0].toFixed(6) : ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (!Number.isFinite(value)) return;
                const next = [value, position ? position[1] : 0];
                setPosition(next);
                onChange?.({ latitude: value, longitude: next[1] });
              }}
              placeholder="Click the map to set"
              className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500 bg-gray-50"
            />
          </div>
          <div>
            <label htmlFor="longitude" className="font-medium text-gray-700">
              Longitude
            </label>
            <input
              id="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              readOnly={disabled}
              value={position ? position[1].toFixed(6) : ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (!Number.isFinite(value)) return;
                const next = [position ? position[0] : 0, value];
                setPosition(next);
                onChange?.({ latitude: next[0], longitude: value });
              }}
              placeholder="Click the map to set"
              className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500 bg-gray-50"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Click the map to place the marker, or drag it to correct the position. Coordinates are
          stored as latitude/longitude and mirrored as a GeoJSON point ([longitude, latitude]).
        </p>
      </div>
    </div>
  );
};

export default LocationPicker;
