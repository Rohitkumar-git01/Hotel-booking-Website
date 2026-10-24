import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { assets } from "../../assets/assets";
import HotelMap from "../../components/HotelMap";
import { AppContext } from "../../context/AppContext";
import { getApprovalMeta } from "../../constants/hotels";

const fallbackImages = [
  assets.roomImg1,
  assets.roomImg2,
  assets.roomImg3,
  assets.roomImg4,
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDays = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const nightsBetween = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
};

/**
 * Public hotel details page with room selection and booking.
 */
const HotelDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSignedIn, openSignIn } = useAuth();
  const { fetchHotelById, createBooking } = useContext(AppContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") || "");
  const [guests, setGuests] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const [bookingRoom, setBookingRoom] = useState(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingMessage, setBookingMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchHotelById(id, {
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
      });
      setData(result);
    } catch (loadError) {
      setError(loadError.message || "Failed to load this hotel");
    } finally {
      setLoading(false);
    }
  }, [id, checkIn, checkOut, fetchHotelById]);

  useEffect(() => {
    load();
  }, [load]);

  const hotel = data?.hotel;
  const rooms = data?.rooms || [];
  const roomTypes = data?.roomTypes || [];
  const status = hotel ? getApprovalMeta(hotel.approvalStatus) : null;

  const images = useMemo(() => {
    if (hotel?.images?.length) return hotel.images;
    return fallbackImages;
  }, [hotel]);

  const nights = nightsBetween(checkIn, checkOut);

  const handleDates = (start, end) => {
    setCheckIn(start);
    setCheckOut(end);
  };

  const handleBook = async (room) => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    if (!checkIn || !checkOut) {
      setBookingMessage({ type: "error", text: "Please choose your check-in and check-out dates." });
      return;
    }

    setBookingBusy(true);
    const result = await createBooking({
      roomId: room._id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guests: Number(guests) || 1,
      paymentMethod: "Pay At Hotel",
    });
    setBookingBusy(false);

    if (!result.success) {
      setBookingMessage({ type: "error", text: result.message });
      await load();
      return;
    }

    setBookingMessage({
      type: "success",
      text: "Booking confirmed. You can find it under 'My Bookings'.",
    });
    setBookingRoom(null);
    await load();
  };

  if (loading && !data) {
    return <div className="pt-40 pb-20 text-center text-lg text-gray-500">Loading hotel...</div>;
  }

  if (error) {
    return (
      <div className="pt-40 pb-20 text-center px-4">
        <p className="text-lg text-red-500">{error}</p>
        <button
          onClick={() => navigate("/hotels")}
          className="mt-4 px-5 py-2 rounded bg-primary text-white text-sm hover:bg-primary-dull transition-all cursor-pointer"
        >
          Back to search
        </button>
      </div>
    );
  }

  if (!hotel) return null;

  const viewer = data.viewer || {};
  const isPending = hotel.approvalStatus && hotel.approvalStatus !== "approved";

  return (
    <div className="pt-28 md:pt-32 px-4 md:px-16 lg:px-24 xl:px-32 pb-20">
      {isPending ? (
        <div className="mb-6 px-4 py-3 rounded text-sm bg-amber-50 text-amber-800 border border-amber-200">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${status.badge}`}>
            {status.label}
          </span>
          {viewer.canManage
            ? "This listing is only visible to you and the administrators until it is approved."
            : "This listing is not published yet."}
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ---------------------------------------------------------- */}
        {/* Left column                                               */}
        {/* ---------------------------------------------------------- */}
        <div className="lg:w-3/5">
          <h1 className="font-playfair text-4xl md:text-[42px] text-gray-800">{hotel.name}</h1>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
            {hotel.category ? <span>{hotel.category}</span> : null}
            {typeof hotel.rating === "number" ? (
              <span className="flex items-center gap-1">
                <img src={assets.starIconFilled} alt="" className="w-4 h-4" />
                {hotel.rating.toFixed(1)}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <img src={assets.locationIcon} alt="" className="w-4 h-4" />
              {[hotel.address, hotel.city, hotel.state, hotel.country]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>

          {/* Gallery */}
          <div className="mt-6 grid grid-cols-4 gap-2">
            <div className="col-span-4 md:col-span-3 row-span-2 h-72 md:h-96 rounded-xl overflow-hidden">
              <img
                src={images[activeImage]}
                alt={hotel.name}
                className="w-full h-full object-cover"
                onError={(event) => {
                  if (!event.target.dataset.fallbackApplied) {
                    event.target.dataset.fallbackApplied = "true";
                    event.target.src = fallbackImages[0];
                  }
                }}
              />
            </div>
            {images.slice(1, 5).map((image, index) => (
              <button
                key={`${image}-${index}`}
                onClick={() => setActiveImage(index + 1)}
                className="hidden md:block h-[calc(50%-0.25rem)] rounded-xl overflow-hidden"
              >
                <img src={image} alt={`${hotel.name} ${index + 2}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Description */}
          {hotel.description ? (
            <div className="mt-8">
              <h2 className="text-xl font-medium text-gray-800">About this hotel</h2>
              <p className="text-gray-600 mt-3 leading-relaxed whitespace-pre-line">
                {hotel.description}
              </p>
            </div>
          ) : null}

          {/* Amenities */}
          {hotel.amenities?.length ? (
            <div className="mt-8">
              <h2 className="text-xl font-medium text-gray-800">Amenities</h2>
              <div className="flex flex-wrap gap-2 mt-3">
                {hotel.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="text-sm px-3 py-1.5 rounded-full bg-gray-100 text-gray-700"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Practical info */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Check-in / Check-out</p>
              <p className="text-gray-800 mt-1">
                {hotel.checkInTime || "14:00"} · {hotel.checkOutTime || "11:00"}
              </p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Contact</p>
              <p className="text-gray-800 mt-1">{hotel.contact}</p>
              {hotel.contactEmail ? (
                <a
                  href={`mailto:${hotel.contactEmail}`}
                  className="text-sm text-primary hover:text-primary-dull"
                >
                  {hotel.contactEmail}
                </a>
              ) : null}
            </div>
          </div>

          {/* Map */}
          <div className="mt-8">
            <h2 className="text-xl font-medium text-gray-800">Location</h2>
            <HotelMap
              className="mt-3"
              latitude={hotel.latitude}
              longitude={hotel.longitude}
              name={hotel.name}
              address={[hotel.address, hotel.city].filter(Boolean).join(", ")}
            />
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Right column: booking                                     */}
        {/* ---------------------------------------------------------- */}
        <div className="lg:w-2/5">
          <div className="border border-gray-200 rounded-2xl p-5 sticky top-28 bg-white">
            <h2 className="text-xl font-medium text-gray-800">Choose your stay</h2>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="detail-checkin" className="text-sm font-medium text-gray-700">
                  Check-in
                </label>
                <input
                  id="detail-checkin"
                  type="date"
                  min={todayIso()}
                  value={checkIn}
                  onChange={(event) => {
                    const start = event.target.value;
                    handleDates(start, start && !checkOut ? addDays(start, 1) : checkOut);
                  }}
                  className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="detail-checkout" className="text-sm font-medium text-gray-700">
                  Check-out
                </label>
                <input
                  id="detail-checkout"
                  type="date"
                  min={checkIn ? addDays(checkIn, 1) : todayIso()}
                  value={checkOut}
                  onChange={(event) => handleDates(checkIn, event.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
                />
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="detail-guests" className="text-sm font-medium text-gray-700">
                Guests
              </label>
              <input
                id="detail-guests"
                type="number"
                min="1"
                max="20"
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-24 mt-1 outline-indigo-500"
              />
            </div>

            {nights > 0 ? (
              <p className="text-sm text-gray-500 mt-3">
                {nights} night{nights === 1 ? "" : "s"} · prices are per night
              </p>
            ) : null}

            {bookingMessage ? (
              <div
                className={`mt-4 px-3 py-2 rounded text-sm ${
                  bookingMessage.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                }`}
              >
                {bookingMessage.text}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3">
              {roomTypes.length === 0 ? (
                <p className="text-sm text-gray-500">
                  This hotel does not have any rooms yet.
                </p>
              ) : (
                roomTypes.map((type) => {
                  const available = type.available ?? 0;
                  return (
                    <div
                      key={type.roomType}
                      className="border border-gray-200 rounded-xl p-3 flex items-center gap-3"
                    >
                      {type.images?.length ? (
                        <img
                          src={type.images[0]}
                          alt={type.roomType}
                          className="w-20 h-16 object-cover rounded-lg"
                        />
                      ) : null}
                      <div className="flex-1">
                        <p className="text-gray-800 font-medium">{type.roomType}</p>
                        <p className="text-sm text-gray-500">
                          {available} of {type.total} available
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-800">${type.pricePerNight}</p>
                        <button
                          disabled={available === 0}
                          onClick={() => {
                            setBookingMessage(null);
                            setBookingRoom(type.roomType);
                          }}
                          className="mt-1 px-4 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary-dull transition-all disabled:opacity-40 cursor-pointer"
                        >
                          {available === 0 ? "Sold out" : "Book"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Room selection modal */}
      {bookingRoom ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl my-8">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-medium text-gray-800">{bookingRoom}</h3>
              <button
                onClick={() => setBookingRoom(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-1">
              Pick one of the available rooms. Each room is a separate bookable unit.
            </p>

            {bookingMessage ? (
              <div
                className={`mt-4 px-3 py-2 rounded text-sm ${
                  bookingMessage.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                }`}
              >
                {bookingMessage.text}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
              {rooms
                .filter(
                  (room) =>
                    room.roomType === bookingRoom && room.isAvailableForDates !== false
                )
                .map((room) => (
                  <div
                    key={room._id}
                    className="border border-gray-200 rounded-xl p-3 flex items-center gap-3"
                  >
                    {room.images?.length ? (
                      <img
                        src={room.images[0]}
                        alt={room.roomType}
                        className="w-20 h-16 object-cover rounded-lg"
                      />
                    ) : null}
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium">{room.roomType}</p>
                      <p className="text-xs text-gray-500">
                        Up to {room.capacity ?? 2} guests
                        {room.amenities?.length ? ` · ${room.amenities.join(", ")}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-800">
                        ${room.pricePerNight}
                        {nights > 0 ? (
                          <span className="block text-xs text-gray-500">
                            ${room.pricePerNight * nights} total
                          </span>
                        ) : null}
                      </p>
                      <button
                        disabled={bookingBusy}
                        onClick={() => handleBook(room)}
                        className="mt-1 px-4 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary-dull transition-all disabled:opacity-60 cursor-pointer"
                      >
                        {bookingBusy ? "Booking..." : "Book this room"}
                      </button>
                    </div>
                  </div>
                ))}

              {rooms.filter(
                (room) =>
                  room.roomType === bookingRoom && room.isAvailableForDates !== false
              ).length === 0 ? (
                <p className="text-sm text-gray-500">
                  No room of this type is free for the selected dates.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HotelDetails;
