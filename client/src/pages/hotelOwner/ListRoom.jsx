import React, { useEffect, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Title from "../../components/Title";
import { AppContext } from "../../context/AppContext";

const ListRoom = () => {
  const navigate = useNavigate();
  const { myRooms, fetchMyRooms, toggleRoomAvailability } = useContext(AppContext);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyRooms();
  }, [fetchMyRooms]);

  const handleToggle = async (roomId) => {
    const res = await toggleRoomAvailability(roomId);
    if (res && !res.success) {
      setError(res.message || "Failed to update room availability");
    }
  };

  return (
    <div>
      <Title
        align="left"
        font="outfit"
        title="Room Listings"
        subTitle="View, edit, or manage all listed rooms. Keep the information up-to-date to provide the best experience for users."
      />

      {error ? (
        <p className="mt-6 px-4 py-3 rounded text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </p>
      ) : null}

      <p className="text-gray-500 mt-8 font-medium">All Rooms</p>
      <div className="w-full max-w-5xl text-left border border-gray-300 rounded-lg max-h-96 overflow-y-scroll mt-3">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-4 text-gray-800 font-medium">Name</th>
              <th className="py-3 px-4 text-gray-800 font-medium max-sm:hidden">
                Hotel
              </th>
              <th className="py-3 px-4 text-gray-800 font-medium max-sm:hidden">
                Facility
              </th>
              <th className="py-3 px-4 text-gray-800 font-medium">Price/ Night</th>
              <th className="py-3 px-4 text-gray-800 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {myRooms.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-10 text-center text-gray-500">
                  No rooms listed yet. Click "Add Room" to create one.
                </td>
              </tr>
            ) : (
              myRooms.map((item, index) => (
                <tr key={item._id || index}>
                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300">
                    {item.roomType}
                  </td>

                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300 max-sm:hidden">
                    {item.hotel?.name || "—"}
                  </td>

                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300 max-sm:hidden">
                    {(item.amenities || []).join(", ")}
                  </td>

                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300">
                    ${item.pricePerNight}
                  </td>

                  <td className="py-3 px-4 border-t border-gray-300 text-sm text-center">
                    <div className="flex items-center justify-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer text-gray-900 gap-3">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={item.isAvailable}
                          onChange={() => handleToggle(item._id)}
                        />
                        <div className="w-12 h-7 bg-slate-300 rounded-full peer peer-checked:bg-blue-600 transition-colors duration-200"></div>
                        <span className="dot absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-5"></span>
                      </label>

                      {item.hotel?._id ? (
                        <button
                          onClick={() =>
                            navigate(`/owner/manage-rooms/${item.hotel._id}`)
                          }
                          className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                        >
                          Manage
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ListRoom;
