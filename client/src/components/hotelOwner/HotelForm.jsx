import React, { useEffect, useMemo, useState } from "react";
import { HOTEL_AMENITIES, HOTEL_CATEGORIES } from "../../constants/hotels";
import LocationPicker from "./LocationPicker";
import ImageUploader from "./ImageUploader";

const EMPTY_FORM = {
  name: "",
  category: "",
  description: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  contact: "",
  contactEmail: "",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  latitude: "",
  longitude: "",
  amenities: [],
};

const inputClass =
  "border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500 bg-white";
const labelClass = "font-medium text-gray-700";

/**
 * Shared add/edit form for a hotel listing.
 *
 * The form only collects data - the parent decides what to do with it
 * (`onSubmit(values, { files })`).
 */
const HotelForm = ({
  initialValues,
  onSubmit,
  onSearchAddress,
  onReverseGeocode,
  existingImages = [],
  images = [],
  onImagesChange,
  onRemoveImage,
  errors = {},
  busy = false,
  submitLabel = "Save hotel",
  cancelLabel,
  onCancel,
}) => {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initialValues || {}) });
  const [amenityError, setAmenityError] = useState("");

  // Re-sync whenever the parent loads (or reloads) the listing. The key is
  // the serialised value so that a new object with the same content does not
  // wipe what the owner has already typed.
  const initialKey = useMemo(() => JSON.stringify(initialValues || {}), [initialValues]);

  useEffect(() => {
    setForm({ ...EMPTY_FORM, ...(initialValues || {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  /**
   * Fills the address fields from the coordinates that were clicked on the
   * map. Existing values are never overwritten.
   */
  const handleReverseGeocode = async (latitude, longitude) => {
    if (!onReverseGeocode) return null;
    try {
      const result = await onReverseGeocode(latitude, longitude);
      const details = result?.address || {};
      const street =
        details.road ||
        details.pedestrian ||
        details.neighbourhood ||
        details.suburb ||
        "";
      const city =
        details.city ||
        details.town ||
        details.village ||
        details.municipality ||
        details.county ||
        "";

      setForm((previous) => ({
        ...previous,
        address: previous.address || [street, details.house_number].filter(Boolean).join(" ") || street,
        city: previous.city || city,
      }));

      return result;
    } catch {
      // A failed lookup is not fatal - the owner can type the address.
      return null;
    }
  };

  const toggleAmenity = (amenity) => {
    setForm((previous) => ({
      ...previous,
      amenities: previous.amenities.includes(amenity)
        ? previous.amenities.filter((item) => item !== amenity)
        : [...previous.amenities, amenity],
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setAmenityError("");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category || undefined,
      description: form.description.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      postalCode: form.postalCode.trim(),
      contact: form.contact.trim(),
      contactEmail: form.contactEmail.trim(),
      checkInTime: form.checkInTime.trim(),
      checkOutTime: form.checkOutTime.trim(),
      amenities: form.amenities,
    };

    // Coordinates are optional, but both values have to be sent together.
    if (form.latitude !== "" && form.longitude !== "") {
      payload.latitude = Number(form.latitude);
      payload.longitude = Number(form.longitude);
    }

    onSubmit?.(payload, { files: images });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl">
      {/* ---------------------------------------------------------------- */}
      {/* Basics                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="border border-gray-200 rounded-xl p-5">
        <h2 className="text-lg font-medium text-gray-800">Hotel details</h2>
        <p className="text-sm text-gray-500">
          These details are shown to guests on the listing page.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="hotel-name" className={labelClass}>
              Hotel name *
            </label>
            <input
              id="hotel-name"
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className={inputClass}
              required
              maxLength={150}
            />
            {errors.name ? (
              <p className="text-sm text-red-600 mt-1">{errors.name}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="hotel-category" className={labelClass}>
              Property type
            </label>
            <select
              id="hotel-category"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              className={inputClass}
            >
              <option value="">Select a property type</option>
              {HOTEL_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.category ? (
              <p className="text-sm text-red-600 mt-1">{errors.category}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="hotel-description" className={labelClass}>
            Description
          </label>
          <textarea
            id="hotel-description"
            rows={4}
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Tell guests what makes your property special."
            className={inputClass}
            maxLength={5000}
          />
          {errors.description ? (
            <p className="text-sm text-red-600 mt-1">{errors.description}</p>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Address                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="border border-gray-200 rounded-xl p-5 mt-5">
        <h2 className="text-lg font-medium text-gray-800">Address</h2>

        <div className="mt-4">
          <label htmlFor="hotel-address" className={labelClass}>
            Full address *
          </label>
          <input
            id="hotel-address"
            type="text"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
            className={inputClass}
            required
            maxLength={400}
          />
          {errors.address ? (
            <p className="text-sm text-red-600 mt-1">{errors.address}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label htmlFor="hotel-city" className={labelClass}>
              City *
            </label>
            <input
              id="hotel-city"
              type="text"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              className={inputClass}
              required
              maxLength={120}
            />
            {errors.city ? (
              <p className="text-sm text-red-600 mt-1">{errors.city}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="hotel-state" className={labelClass}>
              State / Region
            </label>
            <input
              id="hotel-state"
              type="text"
              value={form.state}
              onChange={(e) => setField("state", e.target.value)}
              className={inputClass}
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="hotel-country" className={labelClass}>
              Country
            </label>
            <input
              id="hotel-country"
              type="text"
              value={form.country}
              onChange={(e) => setField("country", e.target.value)}
              className={inputClass}
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="hotel-postal" className={labelClass}>
              PIN / Postal code
            </label>
            <input
              id="hotel-postal"
              type="text"
              value={form.postalCode}
              onChange={(e) => setField("postalCode", e.target.value)}
              className={inputClass}
              maxLength={20}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Location                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="border border-gray-200 rounded-xl p-5 mt-5">
        <h2 className="text-lg font-medium text-gray-800">Location</h2>
        <p className="text-sm text-gray-500">
          Search for the address, then click the map (or drag the marker) to set the exact
          position.
        </p>

        <div className="mt-4">
          <LocationPicker
            latitude={form.latitude === "" ? undefined : Number(form.latitude)}
            longitude={form.longitude === "" ? undefined : Number(form.longitude)}
            onChange={({ latitude, longitude }) =>
              setForm((previous) => ({
                ...previous,
                latitude: latitude ?? "",
                longitude: longitude ?? "",
              }))
            }
            onSearchAddress={onSearchAddress}
            onReverseGeocode={handleReverseGeocode}
            addressLabel={form.address}
            cityLabel={form.city}
          />
          {errors.latitude ? (
            <p className="text-sm text-red-600 mt-1">{errors.latitude}</p>
          ) : null}
          {errors.longitude ? (
            <p className="text-sm text-red-600 mt-1">{errors.longitude}</p>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Contact                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="border border-gray-200 rounded-xl p-5 mt-5">
        <h2 className="text-lg font-medium text-gray-800">Contact & check-in</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="hotel-contact" className={labelClass}>
              Phone number *
            </label>
            <input
              id="hotel-contact"
              type="tel"
              value={form.contact}
              onChange={(e) => setField("contact", e.target.value)}
              className={inputClass}
              required
              maxLength={40}
            />
            {errors.contact ? (
              <p className="text-sm text-red-600 mt-1">{errors.contact}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="hotel-email" className={labelClass}>
              Contact email
            </label>
            <input
              id="hotel-email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setField("contactEmail", e.target.value)}
              className={inputClass}
              maxLength={200}
            />
            {errors.contactEmail ? (
              <p className="text-sm text-red-600 mt-1">{errors.contactEmail}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="hotel-checkin" className={labelClass}>
              Check-in time
            </label>
            <input
              id="hotel-checkin"
              type="time"
              value={form.checkInTime}
              onChange={(e) => setField("checkInTime", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="hotel-checkout" className={labelClass}>
              Check-out time
            </label>
            <input
              id="hotel-checkout"
              type="time"
              value={form.checkOutTime}
              onChange={(e) => setField("checkOutTime", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Amenities                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="border border-gray-200 rounded-xl p-5 mt-5">
        <h2 className="text-lg font-medium text-gray-800">Amenities</h2>
        <p className="text-sm text-gray-500">
          Guests can filter the search results by these amenities.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
          {HOTEL_AMENITIES.map((amenity) => (
            <label
              key={amenity}
              className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer min-h-[44px]"
            >
              <input
                type="checkbox"
                checked={form.amenities.includes(amenity)}
                onChange={() => toggleAmenity(amenity)}
                style={{ width: 18, height: 18, minWidth: 18 }}
              />
              <span className="select-none">{amenity}</span>
            </label>
          ))}
        </div>
        {errors.amenities ? (
          <p className="text-sm text-red-600 mt-2">{errors.amenities}</p>
        ) : null}
        {amenityError ? (
          <p className="text-sm text-red-600 mt-2">{amenityError}</p>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Photos                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="border border-gray-200 rounded-xl p-5 mt-5">
        <ImageUploader
          existingImages={existingImages}
          value={images}
          onChange={onImagesChange}
          onRemoveExisting={onRemoveImage}
          max={10}
        />
      </section>

      <div className="flex items-center gap-3 mt-8">
        <button
          type="submit"
          disabled={busy}
          className="bg-primary hover:bg-primary-dull text-white px-8 py-2.5 rounded cursor-pointer active:scale-95 transition-all disabled:opacity-60"
        >
          {busy ? "Saving..." : submitLabel}
        </button>
        {cancelLabel ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
};

export default HotelForm;
