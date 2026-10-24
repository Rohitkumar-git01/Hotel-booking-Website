import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Title from "../../components/Title";
import ConfirmDialog from "../../components/hotelOwner/ConfirmDialog";
import { AppContext } from "../../context/AppContext";
import { getApprovalMeta } from "../../constants/hotels";

/**
 * All hotels the signed in user manages.
 */
const MyHotels = () => {
  const navigate = useNavigate();
  const { myHotels, myHotelsLoading, myHotelsError, fetchMyHotels, deleteHotel } =
    useContext(AppContext);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchMyHotels();
  }, [fetchMyHotels]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    const result = await deleteHotel(pendingDelete._id);
    setBusy(false);
    setPendingDelete(null);

    if (result.success) {
      setMessage({ type: "success", text: result.message });
    } else {
      setMessage({ type: "error", text: result.message });
    }
  };

  return (
    <div className="pb-16">
      <Title
        align="left"
        font="outfit"
        title="My Hotels"
        subTitle="Every property you manage, with its approval status, inventory and revenue."
      />

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button
          onClick={() => navigate("/owner/add-hotel")}
          className="bg-primary hover:bg-primary-dull text-white px-5 py-2.5 rounded text-sm transition-all cursor-pointer"
        >
          Add a hotel
        </button>
        <button
          onClick={() => fetchMyHotels()}
          className="px-5 py-2.5 rounded text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {message ? (
        <div
          className={`mt-6 px-4 py-3 rounded text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {myHotelsLoading ? (
        <div className="py-20 text-center text-lg text-gray-500">Loading your hotels...</div>
      ) : myHotelsError ? (
        <div className="py-20 text-center">
          <p className="text-lg text-red-500">{myHotelsError}</p>
          <button
            onClick={() => fetchMyHotels()}
            className="mt-4 px-5 py-2 rounded bg-primary text-white text-sm hover:bg-primary-dull transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : myHotels.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          <p className="text-lg">You do not have any listings yet.</p>
          <p className="text-sm mt-2">
            Add your first hotel - an admin will review it before guests can find it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
          {myHotels.map((hotel) => {
            const status = getApprovalMeta(hotel.approvalStatus);
            return (
              <div
                key={hotel._id}
                className="border border-gray-300 rounded-xl p-5 bg-white flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/hotels/${hotel._id}`}
                      className="font-playfair text-xl text-gray-800 hover:text-primary transition-colors"
                    >
                      {hotel.name}
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">
                      {[hotel.address, hotel.city].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.badge}`}
                  >
                    {status.label}
                  </span>
                </div>

                {hotel.rejectionReason ? (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {hotel.rejectionReason}
                  </p>
                ) : null}

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-lg text-gray-800">{hotel.roomCount ?? 0}</p>
                    <p className="text-xs text-gray-500">Rooms</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-lg text-gray-800">{hotel.bookingCount ?? 0}</p>
                    <p className="text-xs text-gray-500">Bookings</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-lg text-gray-800">${hotel.revenue ?? 0}</p>
                    <p className="text-xs text-gray-500">Revenue</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    onClick={() => navigate(`/owner/edit-hotel/${hotel._id}`)}
                    className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => navigate(`/owner/manage-rooms/${hotel._id}`)}
                    className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Manage rooms
                  </button>
                  <button
                    onClick={() => navigate(`/owner/add-room?hotelId=${hotel._id}`)}
                    className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Add room
                  </button>
                  <button
                    onClick={() => setPendingDelete(hotel)}
                    className="px-4 py-2 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.name || ""}"?`}
        message="The listing, its rooms and its photos are removed. Hotels with active bookings cannot be deleted."
        confirmLabel="Delete hotel"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default MyHotels;
