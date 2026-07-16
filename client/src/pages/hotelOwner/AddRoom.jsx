import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { assets } from "../../assets/assets";
import Title from "../../components/Title";
import { AppContext } from "../../context/AppContext";

const AddRoom = () => {
  const navigate = useNavigate();
  const { addRoom } = useContext(AppContext);

  const [images, setImages] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  });

  const [inputs, setInputs] = useState({
    roomType: "",
    pricePerNight: "",
    amenities: {
      "Free WiFi": false,
      "Free Breakfast": false,
      "Room Service": false,
      "Mountain View": false,
      "Pool Access": false,
    },
  });

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

    if (!inputs.roomType) {
      alert("Please select a room type");
      return;
    }

    if (!inputs.pricePerNight || Number(inputs.pricePerNight) <= 0) {
      alert("Please enter a valid price per night");
      return;
    }

    const formData = new FormData();
    formData.append("roomType", inputs.roomType);
    formData.append("pricePerNight", inputs.pricePerNight);

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
      alert("Please upload at least one room image");
      return;
    }

    const res = await addRoom(formData);
    if (res.success) {
      alert("Room added successfully!");
      navigate("/owner/list-room");
    } else {
      alert(res.message || "Failed to add room");
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

      {/* Upload Area For Image */}
      <p className="text-gray-800 mt-10 font-medium">Images</p>
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
            <option value="Single Bed">Single Bed</option>
            <option value="Double Bed">Double Bed</option>
            <option value="Luxury Room">Luxury Room</option>
            <option value="Family Room">Family Room</option>
          </select>
        </div>
        <div>
          <p className="mt-4 text-gray-800 font-medium">
            Price <span className="text-xs font-normal">/night ($)</span>
          </p>
          <input
            type="number"
            placeholder="0"
            required
            className="border border-gray-300 mt-1 rounded p-2 w-32 outline-indigo-500"
            value={inputs.pricePerNight}
            onChange={(e) => setInputs({ ...inputs, pricePerNight: e.target.value })}
          />
        </div>
      </div>

      <p className="text-gray-800 mt-6 font-medium">Amenities</p>
      <div className="flex flex-col gap-2 mt-2 text-gray-600 max-w-sm">
        {Object.keys(inputs.amenities).map((amenity, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`amenity-${index}`}
              checked={inputs.amenities[amenity]}
              onChange={() => handleCheckboxChange(amenity)}
              className="cursor-pointer"
            />
            <label htmlFor={`amenity-${index}`} className="cursor-pointer select-none">
              {amenity}
            </label>
          </div>
        ))}
      </div>

      <button
        type="submit"
        className="bg-primary hover:bg-primary-dull text-white px-8 py-2.5 rounded mt-8 cursor-pointer active:scale-95 transition-all"
      >
        Add Room
      </button>
    </form>
  );
};

export default AddRoom;