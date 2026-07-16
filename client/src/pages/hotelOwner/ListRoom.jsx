import React, { useEffect, useContext } from "react";
import Title from "../../components/Title";
import { AppContext } from "../../context/AppContext";

const ListRoom = () => {
  const { myRooms, fetchMyRooms, toggleRoomAvailability } = useContext(AppContext);

  useEffect(() => {
    fetchMyRooms();
  }, []);

  const handleToggle = async (roomId) => {
    const res = await toggleRoomAvailability(roomId);
    if (res && !res.success) {
      alert(res.message || "Failed to update room availability");
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
      <p className="text-gray-500 mt-8 font-medium">All Rooms</p>
      <div className="w-full max-w-3xl text-left border border-gray-300 rounded-lg max-h-80 overflow-y-scroll mt-3">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-4 text-gray-800 font-medium">Name</th>
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
                <td colSpan="4" className="py-10 text-center text-gray-500">
                  No rooms listed yet. Click "Add Room" to create one.
                </td>
              </tr>
            ) : (
              myRooms.map((item, index) => (
                <tr key={index}>
                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300">
                    {item.roomType}
                  </td>
                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300 max-sm:hidden">
                    {item.amenities.join(", ")}
                  </td>
                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300">
                    ${item.pricePerNight}
                  </td>
                  <td className="py-3 px-4 border-t border-gray-300 text-sm text-center">
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
