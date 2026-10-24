import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { assets } from "../../assets/assets";
import Title from "../../components/Title";
import { AppContext } from "../../context/AppContext";
import { ROOM_TYPES } from "../../constants/hotels";

const ROOM_AMENITIES = [
  "Free WiFi",
  "Free Breakfast",
  "Room Service",
  "Mountain View",
  "Pool Access",
  "Air Conditioning",
];

const AddRoom = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addRoom, myHotels, fetchMyHotels } = useContext(AppContext);

  const [images, setImages] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  });

  const [inputs, setInputs] = useState({
    roomType: "",
    pricePerNight: "",
    capacity: 2,
    description: "",
    amenities: {
      "Free WiFi": false,
      "Free Breakfast": false,
      "Room Service": false,
      "Mountain View": false,
      "Pool Access": false,
      "Air Conditioning": false,
    },
  });

  const [hotelId, setHotelId] = useState(searchParams.get("hotelId") || "");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyHotels();
  }, [fetchMyHotels]);

  // When the owner manages exactly one hotel it is preselected.
  const effectiveHotelId =
    hotelId || (myHotels.length === 1 ? myHotels[0]._id : "");

  const selectedHotel = useMemo(
    () => myHotels.find((hotel) => hotel._id === effectiveHotelId),
    [myHotels, effectiveHotelId]
  );

  const handleImageChange = (key, file) => {
    setImages((prev) => ({ ...prev, [key]: file }));
  };

  const handleCheckboxChange = (amenity) => {
    setInputs((prev) => ({
      ...prev,
      amenities: {
        ...prev.amenities,
        [amenity]: !prev.amenities[amenity],
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!inputs.roomType) {
      setError("Please select a room type");
      return;
    }

    if (!inputs.pricePerNight || Number(inputs.pricePerNight) <= 0) {
      setError("Please enter a valid price per night");
      return;
    }

    if (!effectiveHotelId) {
      setError("Please choose the hotel this room belongs to");
      return;
    }

    const formData = new FormData();
    formData.append("roomType", inputs.roomType);
    formData.append("pricePerNight", inputs.pricePerNight);
    formData.append("capacity", inputs.capacity);
    formData.append("description", inputs.description);
    formData.append("hotelId", effectiveHotelId);

    // Filter out unchecked amenities
    const activeAmenities = Object.keys(inputs.amenities).filter(
      (key) => inputs.amenities[key]
    );
    formData.append("amenities", JSON.stringify(activeAmenities));

    // Append images
    let hasImage = false;
    Object.keys(images).forEach((key) => {
      if (images[key]) {
        formData.append("images", images[key]);
        hasImage = true;
      }
    });

    if (!hasImage) {
      setError("Please upload at least one room image");
      return;
    }

    const res = await addRoom(formData);
    if (res.success) {
      alert("Room added successfully!");
      navigate(`/owner/manage-rooms/${effectiveHotelId}`);
    } else {
      setError(res.message || "Failed to add room");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Title
        align="left"
        font="outfit"
        title="Add Room"
        subTitle="Fill in the details carefully and accurately to enhance the user booking experience."
      />

      {error ? (
        <p className="mt-6 px-4 py-3 rounded text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </p>
      ) : null}

      {/* Hotel selector - an owner can manage several hotels */}
      <div className="w-full flex max-sm:flex-col sm:gap-4 mt-8">
        <div className="flex-1 max-w-sm">
          <p className="text-gray-800 font-medium">Hotel *</p>
          <select
            value={effectiveHotelId}
            onChange={(e) => setHotelId(e.target.value)}
            className="border opacity-70 border-gray-300 mt-1 rounded p-2 w-full outline-indigo-500"
            required
          >
            <option value="">Select a hotel</option>
            {myHotels.map((hotel) => (
              <option key={hotel._id} value={hotel._id}>
                {hotel.name} ({hotel.city})
              </option>
            ))}
          </select>
          {myHotels.length === 0 ? (
            <p className="text-xs text-gray-500 mt-1">
              You do not have a hotel yet. Create one first.
            </p>
          ) : null}
        </div>
      </div>

      {/* Upload Area For Image */}
      <p className="text-gray-800 mt-8 font-medium">Images</p>
      <div className="grid grid-cols-2 sm:flex gap-4 my-2 flex-wrap">
        {Object.keys(images).map((key) => (
          <label htmlFor={`roomImage${key}`} key={key} className="cursor-pointer">
            <div className="w-24 h-24 border border-dashed border-gray-300 rounded flex items-center justify-center overflow-hidden hover:bg-gray-50">
              <img
                className={images[key] ? "w-full h-full object-cover" : "h-8 opacity-60"}
                src={images[key] ? URL.createObjectURL(images[key]) : assets.uploadArea}
                alt=""
              />
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              id={`roomImage${key}`}
              hidden
              onChange={(e) => handleImageChange(key, e.target.files[0])}
            />
          </label>
        ))}
      </div>

      <div className="w-full flex max-sm:flex-col sm:gap-4 mt-4">
        <div className="flex-1 max-w-xs">
          <p className="text-gray-800 mt-4 font-medium">Room Type</p>
          <select
            value={inputs.roomType}
            onChange={(e) => setInputs({ ...inputs, roomType: e.target.value })}
            className="border opacity-70 border-gray-300 mt-1 rounded p-2 w-full outline-indigo-500"
            required
          >
            <option value="">Select Room Type</option>
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mt-4 text-gray-800 font-medium">
            Price <span className="text-xs font-normal">/night ($)</span>
          </p>
          <input
            type="number"
            inputMode="decimal"
            pattern="[0-9]*"
            placeholder="0"
            required
            className="border border-gray-300 mt-1 rounded p-2 w-32 outline-indigo-500"
            value={inputs.pricePerNight}
            onChange={(e) => setInputs({ ...inputs, pricePerNight: e.target.value })}
          />
        </div>
        <div>
          <p className="mt-4 text-gray-800 font-medium">Capacity</p>
          <input
            type="number"
            min="1"
            max="20"
            required
            className="border border-gray-300 mt-1 rounded p-2 w-24 outline-indigo-500"
            value={inputs.capacity}
            onChange={(e) => setInputs({ ...inputs, capacity: e.target.value })}
          />
        </div>
      </div>

      <div className="w-full max-w-lg mt-4">
        <p className="text-gray-800 font-medium">Description</p>
        <input
          type="text"
          placeholder="e.g. Sea view room with a king size bed"
          className="border border-gray-300 mt-1 rounded p-2 w-full outline-indigo-500"
          value={inputs.description}
          onChange={(e) => setInputs({ ...inputs, description: e.target.value })}
        />
      </div>

      <p className="text-gray-800 mt-6 font-medium">Amenities</p>
      <div className="flex flex-col gap-2 mt-2 text-gray-600 max-w-sm">
        {ROOM_AMENITIES.map((amenity, index) => (
          <div key={index} className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`amenity-${index}`}
              checked={inputs.amenities[amenity]}
              onChange={() => handleCheckboxChange(amenity)}
              className="cursor-pointer"
              style={{ width: 20, height: 20, minWidth: 20 }}
            />
            <label htmlFor={`amenity-${index}`} className="cursor-pointer select-none min-h-[44px] flex items-center">
              {amenity}
            </label>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="bg-primary hover:bg-primary-dull text-white px-8 py-2.5 rounded mt-8 cursor-pointer active:scale-95 transition-all"
        >
          Add Room
        </button>
        {selectedHotel ? (
          <button
            type="button"
            onClick={() => navigate(`/owner/manage-rooms/${selectedHotel._id}`)}
            className="px-6 py-2.5 rounded mt-8 border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Manage rooms
          </button>
        ) : null}
      </div>
    </form>
  );
};

export default AddRoom;
