import React, { useState, useContext, useEffect } from "react";
import { assets, facilityIcons } from "../assets/assets";
import { useNavigate, useSearchParams } from "react-router-dom";
import StarRating from "../components/StarRating";
import { AppContext } from "../context/AppContext";

const Checkbox = ({ label, value, selected = false, onChange = () => { } }) => {
  return (
    <label className="flex gap-3 items-center cursor-pointer mt-2 text-sm">
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onChange(e.target.checked, value || label)}
      />
      <span className="font-light select-none">{label}</span>
    </label>
  );
};

const RadioButton = ({ label, selected = false, onChange = () => { } }) => {
  return (
    <label className="flex gap-3 items-center cursor-pointer mt-2 text-sm">
      <input
        type="radio"
        name="sortOption"
        checked={selected}
        onChange={() => onChange(label)}
      />
      <span className="font-light select-none">{label}</span>
    </label>
  );
};

const AllRooms = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const city = searchParams.get("city") || "";
  const [openFilters, setOpenFilters] = useState(false);
  const { rooms, fetchRooms, loading } = useContext(AppContext);

  const roomTypes = [
    "Single Bed",
    "Double Bed",
    "Luxury Room",
    "Family Room",
  ];

  const priceRanges = [
    "0 to 200",
    "200 to 500",
    "500 to 1000",
    "1000 and above",
  ];

  const sortOptions = [
    "Price: Low to High",
    "Price: High to Low",
  ];

  const [selectedRoomTypes, setSelectedRoomTypes] = useState([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState([]);
  const [selectedSort, setSelectedSort] = useState("");

  const handleRoomTypeChange = (checked, type) => {
    if (checked) {
      setSelectedRoomTypes((prev) => [...prev, type]);
    } else {
      setSelectedRoomTypes((prev) => prev.filter((t) => t !== type));
    }
  };

  const handlePriceRangeChange = (checked, range) => {
    if (checked) {
      setSelectedPriceRanges((prev) => [...prev, range]);
    } else {
      setSelectedPriceRanges((prev) => prev.filter((r) => r !== range));
    }
  };

  const handleClearFilters = () => {
    setSelectedRoomTypes([]);
    setSelectedPriceRanges([]);
    setSelectedSort("");
    setSearchParams({});
  };

  // Fetch rooms whenever filter states change
  useEffect(() => {
    fetchRooms({
      roomTypes: selectedRoomTypes.join(","),
      priceRanges: selectedPriceRanges.join(","),
      sort: selectedSort,
      city: city,
    });
  }, [selectedRoomTypes, selectedPriceRanges, selectedSort, city]);

  return (
    <div className="flex flex-col-reverse lg:flex-row items-start justify-between pt-28 md:pt-35 px-4 md:px-16 lg:px-24 xl:px-32">
      <div className="w-full lg:w-3/4">
        <div className="flex flex-col items-start text-left">
          <h1 className="font-playfair text-4xl md:text-[40px]">
            {city ? `Hotel Rooms in ${city}` : "Hotel Rooms"}
          </h1>
          <p className="text-sm md:text-base text-gray-500/90 mt-2 max-w-174">
            Discover our wide range of hotel rooms, each designed to provide you
            with comfort and luxury during your stay. Whether you're looking
            for a cozy single room or a spacious suite, we have the perfect
            accommodation to suit your needs. Our rooms are equipped with
            modern amenities and stylish decor, ensuring a memorable experience
            for every guest.
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-lg text-gray-500">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="py-20 text-center text-lg text-gray-500">No rooms match your filter.</div>
        ) : (
          rooms.map((room) => (
            <div
              key={room._id}
              className="flex flex-col md:flex-row items-start py-10 gap-6 border-b border-gray-300 last:pb-30 last:border-0"
            >
              <img
                onClick={() => {
                  navigate(`/rooms/${room._id}`);
                  window.scrollTo(0, 0);
                }}
                src={room.images[0] || assets.uploadArea}
                alt="hotel-img"
                title="View Room Details"
                className="max-h-65 md:w-1/2 rounded-xl shadow-lg object-cover cursor-pointer"
              />
              <div className="md:w-1/2 flex flex-col gap-2">
                <p className="text-gray-500">{room.hotel?.city || "Unknown City"}</p>
                <p
                  onClick={() => {
                    navigate(`/rooms/${room._id}`);
                    window.scrollTo(0, 0);
                  }}
                  className="text-gray-800 text-3xl font-playfair cursor-pointer"
                >
                  {room.hotel?.name || "Premium Suites"}
                </p>
                <div className="flex items-center">
                  <StarRating />
                  <p className="ml-2 text-sm text-gray-500">250+ Reviews</p>
                </div>
                <div className="flex items-center gap-2 text-gray-500 mt-2 text-sm">
                  <img src={assets.locationIcon} alt="location-icon" />
                  <span>{room.hotel?.address || "Address unavailable"}</span>
                </div>
                {/* Amenities */}
                <div className="flex flex-wrap items-center mt-3 mb-6 gap-4">
                  {room.amenities.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100"
                    >
                      {facilityIcons[item] && (
                        <img src={facilityIcons[item]} alt={item} className="w-5 h-5" />
                      )}
                      <p className="text-xs">{item}</p>
                    </div>
                  ))}
                </div>
                {/* Price per night */}
                <p className="text-xl font-medium text-gray-700">
                  ${room.pricePerNight} /night
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filter Sidebar */}
      <div className="bg-white w-80 border border-gray-300 text-gray-600 max-lg:mb-8 min-lg mt-16 lg:ml-6">
        <div
          className={`flex items-center justify-between px-5 py-2.5 min-lg border-b border-gray-300 ${openFilters && "border-b"
            }`}
        >
          <p className="text-base font-medium text-gray-800">FILTERS</p>
          <div className="text-xs cursor-pointer">
            <span
              onClick={() => setOpenFilters(!openFilters)}
              className="lg:hidden"
            >
              {openFilters ? "HIDE" : "SHOW"}
            </span>
            <span onClick={handleClearFilters} className="hidden lg:block">
              CLEAR
            </span>
          </div>
        </div>
        <div
          className={`${openFilters ? "h-auto" : "h-0 lg:h-auto"
            } overflow-hidden transition-all duration-700`}
        >
          <div className="px-5 pt-5">
            <p className="font-medium text-gray-800 pb-2">Popular filters</p>
            {roomTypes.map((type, index) => (
              <Checkbox
                key={index}
                label={type}
                selected={selectedRoomTypes.includes(type)}
                onChange={handleRoomTypeChange}
              />
            ))}
          </div>
          <div className="px-5 pt-5">
            <p className="font-medium text-gray-800 pb-2">Price Range</p>
            {priceRanges.map((range, index) => (
              <Checkbox
                key={index}
                label={`$ ${range}`}
                value={range}
                selected={selectedPriceRanges.includes(range)}
                onChange={handlePriceRangeChange}
              />
            ))}
          </div>
          <div className="px-5 pt-5 pb-7">
            <p className="font-medium text-gray-800 pb-2">Sort By</p>
            {sortOptions.map((option, index) => (
              <RadioButton
                key={index}
                label={option}
                selected={selectedSort === option}
                onChange={setSelectedSort}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllRooms;