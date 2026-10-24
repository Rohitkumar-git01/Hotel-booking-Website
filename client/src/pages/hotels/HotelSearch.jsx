import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { assets } from "../../assets/assets";
import { AppContext } from "../../context/AppContext";
import {
  HOTEL_AMENITIES,
  HOTEL_CATEGORIES,
  HOTEL_SORT_OPTIONS,
} from "../../constants/hotels";

const todayIso = () => new Date().toISOString().slice(0, 10);

const fallbackImages = [
  assets.roomImg1,
  assets.roomImg2,
  assets.roomImg3,
  assets.roomImg4,
];

const HotelResultCard = ({ hotel, index }) => {
  const image =
    hotel.images && hotel.images.length ? hotel.images[0] : fallbackImages[index % fallbackImages.length];

  return (
    <Link
      to={`/hotels/${hotel._id}`}
      onClick={() => window.scrollTo(0, 0)}
      className="rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
    >
      <div className="relative">
        <img
          src={image}
          alt={hotel.name}
          loading="lazy"
          className="w-full h-48 object-cover"
          onError={(event) => {
            const fallback = fallbackImages[index % fallbackImages.length];
            if (!event.target.dataset.fallbackApplied) {
              event.target.dataset.fallbackApplied = "true";
              event.target.src = fallback;
            }
          }}
        />
        {hotel.category ? (
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-700">
            {hotel.category}
          </span>
        ) : null}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-playfair text-xl text-gray-800">{hotel.name}</h3>
          {typeof hotel.rating === "number" ? (
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <img src={assets.starIconFilled} alt="" className="w-4 h-4" />
              {hotel.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        <p className="flex items-center gap-1 text-sm text-gray-500">
          <img src={assets.locationIcon} alt="" className="w-4 h-4" />
          {[hotel.address, hotel.city].filter(Boolean).join(", ")}
        </p>

        {hotel.amenities?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {hotel.amenities.slice(0, 4).map((amenity) => (
              <span
                key={amenity}
                className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
              >
                {amenity}
              </span>
            ))}
            {hotel.amenities.length > 4 ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                +{hotel.amenities.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-end justify-between mt-auto pt-3 border-t border-gray-100">
          <div>
            {hotel.minPrice !== null && hotel.minPrice !== undefined ? (
              <p className="text-xl text-gray-800">
                ${hotel.minPrice}
                <span className="text-sm text-gray-500">/night</span>
              </p>
            ) : (
              <p className="text-sm text-gray-500">No rooms available</p>
            )}
            <p className="text-xs text-gray-500">
              {hotel.roomCount || 0} room{hotel.roomCount === 1 ? "" : "s"} available
            </p>
          </div>
          <span className="px-4 py-2 text-sm font-medium border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-all">
            View
          </span>
        </div>
      </div>
    </Link>
  );
};

/**
 * Public hotel search: filters, sorting and pagination.
 */
const HotelSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hotels, hotelsPagination, hotelsLoading, hotelsError, fetchHotels } =
    useContext(AppContext);

  const [city, setCity] = useState(searchParams.get("city") || "");
  const [categories, setCategories] = useState(
    searchParams.get("category") ? searchParams.get("category").split(",") : []
  );
  const [amenities, setAmenities] = useState(
    searchParams.get("amenities") ? searchParams.get("amenities").split(",") : []
  );
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [showFilters, setShowFilters] = useState(false);

  // Mirror the filters into the address bar. This is kept out of `load` on
  // purpose: `setSearchParams` gets a new identity whenever the query string
  // changes, so mixing it into the fetch callback would trigger an extra
  // request on every URL update.
  useEffect(() => {
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (categories.length) params.set("category", categories.join(","));
    if (amenities.length) params.set("amenities", amenities.join(","));
    if (minPrice !== "") params.set("minPrice", minPrice);
    if (maxPrice !== "") params.set("maxPrice", maxPrice);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (sort) params.set("sort", sort);
    if (page > 1) params.set("page", String(page));

    setSearchParams(params, { replace: true });
  }, [
    city,
    categories,
    amenities,
    minPrice,
    maxPrice,
    checkIn,
    checkOut,
    sort,
    page,
    setSearchParams,
  ]);

  const load = useCallback(async () => {
    await fetchHotels({
      city: city.trim(),
      category: categories,
      amenities,
      minPrice,
      maxPrice,
      checkIn,
      checkOut,
      sort,
      page,
      limit: 12,
    });
  }, [
    city,
    categories,
    amenities,
    minPrice,
    maxPrice,
    checkIn,
    checkOut,
    sort,
    page,
    fetchHotels,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleValue = (value, list, setter) => {
    setter(
      list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setCity("");
    setCategories([]);
    setAmenities([]);
    setMinPrice("");
    setMaxPrice("");
    setCheckIn("");
    setCheckOut("");
    setSort("newest");
    setPage(1);
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row items-start justify-between pt-28 md:pt-35 px-4 md:px-16 lg:px-24 xl:px-32 pb-16">
      <div className="w-full lg:w-3/4">
        <h1 className="font-playfair text-4xl md:text-[40px]">
          {city ? `Hotels in ${city}` : "All hotels"}
        </h1>
        <p className="text-sm md:text-base text-gray-500/90 mt-2 max-w-174">
          Browse the approved properties on QuickStay. Use the filters to narrow the results by
          location, price, amenities and availability.
        </p>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters((value) => !value)}
          className="lg:hidden mt-6 px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 bg-white"
        >
          {showFilters ? "Hide filters" : "Show filters"}
        </button>

        {hotelsLoading && hotels.length === 0 ? (
          <div className="py-20 text-center text-lg text-gray-500">Loading hotels...</div>
        ) : hotelsError && hotels.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-3">
            <p className="text-lg text-red-500">Could not load hotels</p>
            <p className="text-sm text-gray-500 max-w-md">{hotelsError}</p>
            <button
              onClick={load}
              className="px-5 py-2 rounded bg-primary text-white text-sm hover:bg-primary-dull transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : hotels.length === 0 ? (
          <div className="py-20 text-center text-lg text-gray-500">
            No hotels match your filters.
          </div>
        ) : (
          <>
            {hotelsLoading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
                <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                Updating results...
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mt-8">
              {hotels.map((hotel, index) => (
                <HotelResultCard key={hotel._id} hotel={hotel} index={index} />
              ))}
            </div>

            {hotelsPagination && hotelsPagination.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {hotelsPagination.page} of {hotelsPagination.totalPages} ·{" "}
                  {hotelsPagination.total} hotels
                </span>
                <button
                  onClick={() =>
                    setPage((current) => Math.min(hotelsPagination.totalPages, current + 1))
                  }
                  disabled={page >= hotelsPagination.totalPages}
                  className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white w-80 border border-gray-300 text-gray-600 max-lg:mb-8 min-lg mt-16 lg:ml-6">
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-300">
          <p className="text-base font-medium text-gray-800">FILTERS</p>
          <span
            onClick={clearFilters}
            className="text-xs cursor-pointer text-gray-500 hover:text-gray-800"
          >
            CLEAR
          </span>
        </div>

        <div className={`${showFilters ? "block" : "hidden lg:block"} px-5 pt-5 pb-7`}>
          <div>
            <label htmlFor="search-city" className="font-medium text-gray-800">
              City or name
            </label>
            <input
              id="search-city"
              type="text"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setPage(1);
              }}
              placeholder="e.g. Dubai"
              className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
            />
          </div>

          <div className="mt-5">
            <label htmlFor="search-checkin" className="font-medium text-gray-800">
              Check-in
            </label>
            <input
              id="search-checkin"
              type="date"
              min={todayIso()}
              value={checkIn}
              onChange={(event) => {
                setCheckIn(event.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
            />
          </div>

          <div className="mt-3">
            <label htmlFor="search-checkout" className="font-medium text-gray-800">
              Check-out
            </label>
            <input
              id="search-checkout"
              type="date"
              min={checkIn || todayIso()}
              value={checkOut}
              onChange={(event) => {
                setCheckOut(event.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
            />
          </div>

          <div className="mt-5">
            <p className="font-medium text-gray-800 pb-2">Price per night</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(event) => {
                  setMinPrice(event.target.value);
                  setPage(1);
                }}
                placeholder="Min"
                className="border border-gray-300 rounded px-3 py-2 w-full outline-indigo-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(event) => {
                  setMaxPrice(event.target.value);
                  setPage(1);
                }}
                placeholder="Max"
                className="border border-gray-300 rounded px-3 py-2 w-full outline-indigo-500"
              />
            </div>
          </div>

          <div className="mt-5">
            <p className="font-medium text-gray-800 pb-2">Property type</p>
            {HOTEL_CATEGORIES.map((category) => (
              <label
                key={category}
                className="flex gap-3 items-center cursor-pointer mt-1 text-sm min-h-[40px]"
              >
                <input
                  type="checkbox"
                  checked={categories.includes(category)}
                  onChange={() => toggleValue(category, categories, setCategories)}
                  style={{ width: 16, height: 16, minWidth: 16 }}
                />
                <span className="font-light select-none">{category}</span>
              </label>
            ))}
          </div>

          <div className="mt-5">
            <p className="font-medium text-gray-800 pb-2">Amenities</p>
            <div className="max-h-56 overflow-y-auto">
              {HOTEL_AMENITIES.map((amenity) => (
                <label
                  key={amenity}
                  className="flex gap-3 items-center cursor-pointer mt-1 text-sm min-h-[40px]"
                >
                  <input
                    type="checkbox"
                    checked={amenities.includes(amenity)}
                    onChange={() => toggleValue(amenity, amenities, setAmenities)}
                    style={{ width: 16, height: 16, minWidth: 16 }}
                  />
                  <span className="font-light select-none">{amenity}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="search-sort" className="font-medium text-gray-800">
              Sort by
            </label>
            <select
              id="search-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
            >
              {HOTEL_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelSearch;
