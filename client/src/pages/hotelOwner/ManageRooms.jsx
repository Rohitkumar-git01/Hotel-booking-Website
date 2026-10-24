import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Title from "../../components/Title";
import ConfirmDialog from "../../components/hotelOwner/ConfirmDialog";
import { AppContext } from "../../context/AppContext";
import { ROOM_TYPES } from "../../constants/hotels";

const EMPTY_ROOM = {
  roomType: "",
  pricePerNight: "",
  capacity: 2,
  description: "",
  amenities: [],
  isAvailable: true,
};

/**
 * Room management for one hotel: inventory, pricing, availability.
 */
const ManageRooms = () => {
  const { hotelId } = useParams();
  const navigate = useNavigate();
  const {
    fetchHotelRooms,
    toggleRoomAvailability,
    updateRoom,
    deleteRoom,
  } = useContext(AppContext);

  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_ROOM });
  const [formErrors, setFormErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchHotelRooms(hotelId);
      setHotel(data.hotel);
      setRooms(data.rooms || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load the rooms");
    } finally {
      setLoading(false);
    }
  }, [hotelId, fetchHotelRooms]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (room) => {
    const result = await toggleRoomAvailability(room._id);
    if (result && !result.success) {
      setMessage({ type: "error", text: result.message });
      return;
    }
    await load();
  };

  const startEditing = (room) => {
    setEditing(room._id);
    setFormErrors({});
    setEditForm({
      roomType: room.roomType || "",
      pricePerNight: room.pricePerNight ?? "",
      capacity: room.capacity ?? 2,
      description: room.description || "",
      amenities: Array.isArray(room.amenities) ? room.amenities : [],
      isAvailable: room.isAvailable !== false,
    });
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormErrors({});

    const result = await updateRoom(editing, {
      roomType: editForm.roomType,
      pricePerNight: Number(editForm.pricePerNight),
      capacity: Number(editForm.capacity),
      description: editForm.description,
      amenities: editForm.amenities,
      isAvailable: editForm.isAvailable,
    });

    setBusy(false);

    if (!result.success) {
      setFormErrors(result.errors || {});
      setMessage({ type: "error", text: result.message });
      return;
    }

    setMessage({ type: "success", text: result.message });
    setEditing(null);
    await load();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    const result = await deleteRoom(pendingDelete._id);
    setBusy(false);
    setPendingDelete(null);

    if (result.success) {
      setMessage({ type: "success", text: result.message });
      await load();
    } else {
      setMessage({ type: "error", text: result.message });
    }
  };

  const toggleEditAmenity = (amenity) => {
    setEditForm((previous) => ({
      ...previous,
      amenities: previous.amenities.includes(amenity)
        ? previous.amenities.filter((item) => item !== amenity)
        : [...previous.amenities, amenity],
    }));
  };

  return (
    <div className="pb-16">
      <Title
        align="left"
        font="outfit"
        title="Manage Rooms"
        subTitle={
          hotel
            ? `Rooms of ${hotel.name}. Each room is a separate bookable unit.`
            : "Rooms of this hotel."
        }
      />

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button
          onClick={() => navigate(`/owner/add-room?hotelId=${hotelId}`)}
          className="bg-primary hover:bg-primary-dull text-white px-5 py-2.5 rounded text-sm transition-all cursor-pointer"
        >
          Add a room
        </button>
        <button
          onClick={() => navigate("/owner/my-hotels")}
          className="px-5 py-2.5 rounded text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
        >
          Back to my hotels
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

      {loading ? (
        <div className="py-20 text-center text-lg text-gray-500">Loading rooms...</div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="text-lg text-red-500">{error}</p>
          <button
            onClick={load}
            className="mt-4 px-5 py-2 rounded bg-primary text-white text-sm hover:bg-primary-dull transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          <p className="text-lg">This hotel has no rooms yet.</p>
          <p className="text-sm mt-2">Add the first room to start taking bookings.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-8">
          {rooms.map((room) => (
            <div
              key={room._id}
              className="border border-gray-300 rounded-xl p-4 bg-white"
            >
              <div className="flex flex-col md:flex-row gap-4">
                {room.images?.length ? (
                  <img
                    src={room.images[0]}
                    alt={room.roomType}
                    className="w-full md:w-40 h-28 object-cover rounded-lg"
                  />
                ) : null}

                <div className="flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg text-gray-800">{room.roomType}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Capacity {room.capacity ?? 2} guests
                        {room.description ? ` · ${room.description}` : ""}
                      </p>
                    </div>
                    <p className="text-xl text-gray-800">
                      ${room.pricePerNight}
                      <span className="text-sm text-gray-500">/night</span>
                    </p>
                  </div>

                  {room.amenities?.length ? (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {room.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <label className="relative inline-flex items-center cursor-pointer text-gray-900 gap-3">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={room.isAvailable !== false}
                        onChange={() => handleToggle(room)}
                      />
                      <div className="w-12 h-7 bg-slate-300 rounded-full peer peer-checked:bg-blue-600 transition-colors duration-200" />
                      <span className="dot absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-5" />
                    </label>
                    <span className="text-sm text-gray-600">
                      {room.isAvailable !== false ? "Bookable" : "Not bookable"}
                    </span>

                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() => startEditing(room)}
                        className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setPendingDelete(room)}
                        className="px-4 py-2 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {editing === room._id ? (
                <form
                  onSubmit={handleUpdate}
                  className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="font-medium text-gray-700">Room type</label>
                    <select
                      value={editForm.roomType}
                      onChange={(e) =>
                        setEditForm((previous) => ({
                          ...previous,
                          roomType: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
                    >
                      {ROOM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {formErrors.roomType ? (
                      <p className="text-sm text-red-600 mt-1">{formErrors.roomType}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="font-medium text-gray-700">Price / night</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.pricePerNight}
                      onChange={(e) =>
                        setEditForm((previous) => ({
                          ...previous,
                          pricePerNight: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
                    />
                    {formErrors.pricePerNight ? (
                      <p className="text-sm text-red-600 mt-1">
                        {formErrors.pricePerNight}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="font-medium text-gray-700">Capacity</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={editForm.capacity}
                      onChange={(e) =>
                        setEditForm((previous) => ({
                          ...previous,
                          capacity: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-gray-700">Description</label>
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((previous) => ({
                          ...previous,
                          description: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="font-medium text-gray-700">Amenities</label>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {[
                        "Free WiFi",
                        "Free Breakfast",
                        "Room Service",
                        "Mountain View",
                        "Pool Access",
                        "Air Conditioning",
                      ].map((amenity) => (
                        <label
                          key={amenity}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editForm.amenities.includes(amenity)}
                            onChange={() => toggleEditAmenity(amenity)}
                            style={{ width: 16, height: 16, minWidth: 16 }}
                          />
                          {amenity}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={busy}
                      className="bg-primary hover:bg-primary-dull text-white px-6 py-2 rounded text-sm transition-all cursor-pointer disabled:opacity-60"
                    >
                      {busy ? "Saving..." : "Save room"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="px-6 py-2 rounded text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete this ${pendingDelete?.roomType || "room"}?`}
        message="The room is removed from the listing. Rooms with active bookings cannot be deleted."
        confirmLabel="Delete room"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default ManageRooms;
