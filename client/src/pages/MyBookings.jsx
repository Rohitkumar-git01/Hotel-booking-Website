import React, { useEffect, useState, useContext } from "react";
import Title from "../components/Title";
import { assets } from "../assets/assets";
import { AppContext } from "../context/AppContext";
import PaymentModal from "../components/PaymentModal";

const MyBookings = () => {
  const { myBookings, fetchUserBookings, payBooking, cancelBooking } = useContext(AppContext);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);

  useEffect(() => {
    fetchUserBookings();
  }, [fetchUserBookings]);

  const handleConfirmPayment = async (paymentMethod) => {
    if (!selectedBookingForPayment) return;
    const res = await payBooking(selectedBookingForPayment._id, paymentMethod);
    if (res.success) {
      setSelectedBookingForPayment(null);
    } else {
      alert(res.message || "Failed to make payment");
    }
  };

  const handleCancel = async (bookingId) => {
    if (window.confirm("Are you sure you want to cancel this booking?")) {
      const res = await cancelBooking(bookingId);
      if (res.success) {
        alert("Booking cancelled successfully!");
      } else {
        alert(res.message || "Failed to cancel booking");
      }
    }
  };

  return (
    <div className="py-28 md:pb-35 md:pt-32 px-4 md:px-16 lg:px-24 xl:px-32">
      <Title
        title="My Bookings"
        subTitle="View and manage your bookings, plan your trips with just a few clicks. Visit our palace to make your dream vacation a reality. We provide the best and most affordable accommodation options for your perfect getaway. Enjoy your stay!"
        align="left"
      />

      <div className="max-w-6xl mt-8 w-full text-gray-800">
        <div className="hidden md:grid md:grid-cols-[3fr_2fr_1fr] w-full border-b border-gray-300 font-medium text-base py-3">
          <div className="w-1/3">Hotels</div>
          <div className="w-1/3">Date & Time</div>
          <div className="w-1/3">Payment / Actions</div>
        </div>

        {myBookings.length === 0 ? (
          <div className="py-12 text-center text-gray-500">You don't have any bookings yet.</div>
        ) : (
          myBookings.map((booking) => (
            <div
              key={booking._id}
              className="grid grid-cols-1 md:grid-cols-[3fr_2fr_1fr] w-full border-b border-gray-300 py-6 first:border-t"
            >
              {/* --------Hotel Details------- */}
              <div className="flex flex-col md:flex-row">
                <img
                  src={booking.room?.images?.[0] || assets.uploadArea}
                  alt="hotel-img"
                  className="w-44 rounded shadow object-cover h-28"
                />
                <div className="flex flex-col gap-1.5 max-md:mt-3 md:ml-4">
                  <p className="font-playfair text-2xl">
                    {booking.hotel?.name || "Premium Suites"}
                    <span className="font-inter text-sm">
                      {" "}
                      ({booking.room?.roomType || "Room"})
                    </span>
                  </p>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <img src={assets.locationIcon} alt="location-icon" />
                    <span>{booking.hotel?.address || "Address unavailable"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <img src={assets.guestsIcon} alt="guests-icon" />
                    <span>Guests: {booking.guests}</span>
                  </div>
                  <p className="text-base font-semibold">Total: ${booking.totalPrice}</p>
                </div>
              </div>

              {/* -------Date & Time---------- */}
              <div className="flex flex-col gap-2 justify-center max-md:my-4">
                <div>
                  <p className="font-medium text-sm text-gray-400">Check-In</p>
                  <p className="text-gray-700 text-sm font-semibold">
                    {new Date(booking.checkInDate).toDateString()}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-400">Check-Out</p>
                  <p className="text-gray-700 text-sm font-semibold">
                    {new Date(booking.checkOutDate).toDateString()}
                  </p>
                </div>
              </div>

              {/* -------Payment Status / Actions------- */}
              <div className="flex flex-col items-start justify-center gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      booking.status === "cancelled"
                        ? "bg-gray-400"
                        : booking.isPaid
                        ? "bg-green-500"
                        : "bg-amber-500"
                    }`}
                  ></div>
                  <div className="flex flex-col">
                    <p
                      className={`text-sm font-medium ${
                        booking.status === "cancelled"
                          ? "text-gray-400"
                          : booking.isPaid
                          ? "text-green-600"
                          : "text-amber-600"
                      }`}
                    >
                      {booking.status === "cancelled"
                        ? "Cancelled"
                        : booking.isPaid
                        ? "Paid"
                        : "Unpaid"}
                    </p>
                    {booking.paymentMethod && (
                      <span className="text-[11px] text-gray-500 font-medium">
                        Via {booking.paymentMethod}
                      </span>
                    )}
                  </div>
                </div>

                {booking.status !== "cancelled" && (
                  <div className="flex flex-col gap-2 w-full mt-1">
                    {!booking.isPaid && (
                      <button
                        onClick={() => setSelectedBookingForPayment(booking)}
                        className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-full hover:shadow transition-all cursor-pointer w-32"
                      >
                        Pay Now
                      </button>
                    )}
                    <button
                      onClick={() => handleCancel(booking._id)}
                      className="px-4 py-1.5 text-xs border border-red-400 text-red-500 rounded-full hover:bg-red-50 transition-all cursor-pointer w-32"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment Modal */}
      {selectedBookingForPayment && (
        <PaymentModal
          isOpen={!!selectedBookingForPayment}
          onClose={() => setSelectedBookingForPayment(null)}
          bookingDetails={{
            hotelName: selectedBookingForPayment.hotel?.name,
            roomType: selectedBookingForPayment.room?.roomType,
            checkInDate: new Date(selectedBookingForPayment.checkInDate).toLocaleDateString(),
            checkOutDate: new Date(selectedBookingForPayment.checkOutDate).toLocaleDateString(),
            totalPrice: selectedBookingForPayment.totalPrice,
          }}
          onConfirmPayment={handleConfirmPayment}
        />
      )}
    </div>
  );
};

export default MyBookings;