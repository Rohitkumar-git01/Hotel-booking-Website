import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { assets, facilityIcons, roomCommonData } from "../assets/assets";
import StarRating from "../components/StarRating";
import { AppContext } from "../context/AppContext";
import PaymentModal from "../components/PaymentModal";

// Local fallback images from assets
const fallbackImages = [
  assets.roomImg1,
  assets.roomImg2,
  assets.roomImg3,
  assets.roomImg4,
];

const RoomDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchRoomById, createBooking } = useContext(AppContext);

  const [room, setRoom] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [guests, setGuests] = useState(1);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const loadRoom = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRoomById(id);
        if (data) {
          setRoom(data);
          // Use first real image OR first local fallback
          setMainImage(
            data.images && data.images.length > 0 && data.images[0]
              ? data.images[0]
              : fallbackImages[0]
          );
        } else {
          setError("Room not found. It may have been removed or the link is incorrect.");
        }
      } catch (err) {
        setError(err.message || "Failed to load room details. Please try again.");
      }
      setLoading(false);
    };
    loadRoom();
  }, [id, fetchRoomById]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Calculate nights & total price
  const calculateTotal = () => {
    if (!checkInDate || !checkOutDate || !room) return 0;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    return diffDays * room.pricePerNight;
  };

  const handleBookSubmit = (e) => {
    e.preventDefault();
    if (!checkInDate || !checkOutDate) {
      alert("Please select valid Check-In and Check-Out dates");
      return;
    }
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (paymentMethod, txnId) => {
    const bookingData = {
      roomId: id,
      checkInDate,
      checkOutDate,
      guests,
      paymentMethod,
      transactionId: txnId,
    };

    const res = await createBooking(bookingData);
    if (res.success) {
      navigate("/my-bookings");
    } else {
      alert(res.message || "Failed to create booking.");
    }
  };

  if (loading) {
    return (
      <div className="py-35 text-center text-lg text-gray-500">
        Loading room details...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="py-35 text-center flex flex-col items-center gap-4">
        <p className="text-lg text-red-500">{error || "Room not found."}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 rounded bg-primary text-white text-sm hover:bg-primary-dull transition-all"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="py-28 md:py-35 px-4 md:px-16 lg:px-24 xl:px-32">
      {/* room Detail */}
      <div className="flex flex-col md:flex-row item-start md:item-center gap-2">
        <h1 className="text-3xl md:text-4xl font-playfair">
          {room.hotel?.name || "Premium Suites"}
          <span className="font-inter text-sm">({room.roomType})</span>
        </h1>
        <p className="text-xs font-inter py-1.5 px-3 text-white bg-orange-500 rounded-full">
          20% OFF
        </p>
      </div>

      {/* room ratings */}
      <div className="flex items-center gap-1 mt-2">
        <StarRating />
        <p className="ml-2 text-sm text-gray-500">200+ Reviews</p>
      </div>

      {/* room address */}
      <div className="flex items-center gap-1 text-gray-500 mt-2">
        <img src={assets.locationIcon} alt="location-icon" />
        <span>{room.hotel?.address || "Address details unavailable"}</span>
      </div>

      {/* room Images */}
      <div className="flex flex-col lg:flex-row mt-6 gap-6">
        <div className="lg:w-1/2 w-full">
          <img
            src={mainImage || fallbackImages[0]}
            alt="Room Image"
            className="w-full rounded-xl shadow-lg object-cover max-h-96"
            onError={(e) => {
              const fb = fallbackImages[0];
              if (!e.target.dataset.fallbackApplied && e.target.src !== new URL(fb, window.location.href).href) {
                e.target.dataset.fallbackApplied = "true";
                e.target.src = fb;
              }
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:w-1/2 w-full">
          {/* Show real images if available, otherwise show all 4 local fallback images */}
          {(room.images && room.images.length > 0 ? room.images : fallbackImages).map((image, index) => (
            <img
              onClick={() => setMainImage(image)}
              key={index}
              src={image}
              alt="Room Image"
              loading="lazy"
              decoding="async"
              className={`w-full rounded-xl shadow-lg object-cover cursor-pointer max-h-44 ${
                mainImage === image ? "outline-3 outline-orange-500" : ""
              }`}
              onError={(e) => {
                const fb = fallbackImages[index % fallbackImages.length];
                if (!e.target.dataset.fallbackApplied && e.target.src !== new URL(fb, window.location.href).href) {
                  e.target.dataset.fallbackApplied = "true";
                  e.target.src = fb;
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* room highlights */}
      <div className="flex flex-col md:flex-row md:justify-between mt-10">
        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-playfair">
            Experience Luxury Like Never Before
          </h1>
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
        </div>
        {/*room price */}
        <p className="text-2xl font-medium">${room.pricePerNight}/night</p>
      </div>

      {/* CheckIn and CheckOut */}
      <form
        onSubmit={handleBookSubmit}
        className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white shadow-[0px_0px_20px_rgba(0,0,0,0.15)] p-6 rounded-xl mx-auto mt-16 max-w-6xl"
      >
        <div className="flex flex-col flex-wrap md:flex-row items-start md:items-center gap-4 md:gap-10 text-gray-500">
          <div className="flex flex-col">
            <label htmlFor="checkInDate" className="font-medium">
              Check-In
            </label>
            <input
              type="date"
              id="checkInDate"
              value={checkInDate}
              min={today}
              onChange={(e) => setCheckInDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none"
              required
            />
          </div>
          <div className="w-px h-15 bg-gray-300/70 max-md:hidden"></div>
          <div className="flex flex-col">
            <label htmlFor="checkOutDate" className="font-medium">
              Check-Out
            </label>
            <input
              type="date"
              id="checkOutDate"
              value={checkOutDate}
              min={checkInDate || today}
              onChange={(e) => setCheckOutDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none"
              required
            />
          </div>
          <div className="w-px h-15 bg-gray-300/70 max-md:hidden"></div>
          <div className="flex flex-col">
            <label htmlFor="guests" className="font-medium">
              Guests
            </label>
            <input
              type="number"
              id="guests"
              min="1"
              max="10"
              inputMode="numeric"
              pattern="[0-9]*"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className="max-w-20 rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-primary hover:bg-primary-dull active:scale-95 transition-all text-white rounded-md max-md:w-full max-md:mt-6 md:px-25 py-3 md:py-4 text-base cursor-pointer"
        >
          Book Now
        </button>
      </form>

      {/* common specifications */}
      <div className="mt-25 space-y-4">
        {roomCommonData.map((spec, index) => (
          <div key={index} className="flex items-start gap-2">
            <img src={spec.icon} alt={`${spec.title}-icon`} className="w-6.5" />
            <div>
              <p className="text-base">{spec.title}</p>
              <p className="text-gray-500">{spec.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="max-w-3xl border-y border-gray-300 my-15 py-10 text-gray-500">
        <p>
          Guests will be allocated on the ground floor according to availability.
          The hotel will try to accommodate guest preferences, but specific room
          requests cannot be guaranteed. The hotel will do its best to
          accommodate guests' preferences, but specific room requests cannot be
          guaranteed.
        </p>
      </div>

      {/* Hosted by */}
      <div className="flex flex-col items-start gap-4">
        <div className="flex gap-4">
          <img
            src={room.hotel?.owner?.image || assets.userIcon}
            alt="Host"
            loading="lazy"
            decoding="async"
            className="h-14 w-14 md:h-18 md:w-18 rounded-full object-cover"
          />
          <div>
            <p className="text-lg md:text-xl">Hosted by {room.hotel?.name}</p>
            <div className="flex items-center mt-1">
              <StarRating />
              <p className="ml-2 text-sm text-gray-500">250+ reviews</p>
            </div>
          </div>
        </div>
        <button className="px-6 py-2.5 mt-4 rounded text-white bg-primary hover:bg-primary-dull transition-all cursor-pointer">
          Contact Now
        </button>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        bookingDetails={{
          hotelName: room.hotel?.name,
          roomType: room.roomType,
          checkInDate,
          checkOutDate,
          totalPrice: calculateTotal(),
        }}
        onConfirmPayment={handleConfirmPayment}
      />
    </div>
  );
};

export default RoomDetails;