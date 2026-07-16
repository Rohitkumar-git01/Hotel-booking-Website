import React, { useEffect, useContext } from "react";
import Title from "../../components/Title";
import { assets } from "../../assets/assets";
import { AppContext } from "../../context/AppContext";

const Dashboard = () => {
  const { dashboardData, fetchDashboardData } = useContext(AppContext);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (!dashboardData) {
    return (
      <div className="py-20 text-center text-lg text-gray-500">
        Loading dashboard details...
      </div>
    );
  }

  return (
    <div>
      <Title
        align="left"
        font="outfit"
        title="Dashboard"
        subTitle="Monitor your room listings, track bookings, and analyze revenue in one place. Stay updated with real-time insights to ensure smooth operations."
      />

      <div className="flex gap-4 my-8">
        {/*----Total Bookings-----*/}
        <div className="bg-primary/5 border border-primary/10 rounded flex p-4 pr-8 items-center">
          <img src={assets.totalBookingIcon} alt="" className="max-sm:hidden h-10" />
          <div className="flex flex-col sm:ml-4 font-medium">
            <p className="text-blue-900 text-lg">Total Bookings</p>
            <p className="text-neutral-500 text-base">{dashboardData.totalBookings}</p>
          </div>
        </div>
        {/*----Total Revenue----*/}
        <div className="bg-primary/5 border border-primary/10 rounded flex p-4 pr-8 items-center">
          <img src={assets.totalRevenueIcon} alt="" className="max-sm:hidden h-10" />
          <div className="flex flex-col sm:ml-4 font-medium">
            <p className="text-blue-900 text-lg">Total Revenue</p>
            <p className="text-neutral-500 text-base">$ {dashboardData.totalRevenue}</p>
          </div>
        </div>
      </div>

      {/*----recent bookings-----*/}
      <h2 className="text-xl text-blue-950/70 font-medium mb-5">Recent Bookings</h2>

      <div className="w-full max-w-3xl text-left border border-gray-300 rounded-lg max-h-80 overflow-y-scroll">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-4 text-gray-800 font-medium">User Name</th>
              <th className="py-3 px-4 text-gray-800 font-medium max-sm:hidden">Room Name</th>
              <th className="py-3 px-4 text-gray-800 font-medium text-center">Total Amount</th>
              <th className="py-3 px-4 text-gray-800 font-medium text-center">Payment Status</th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {dashboardData.bookings.length === 0 ? (
              <tr>
                <td colSpan="4" className="py-10 text-center text-gray-500">
                  No bookings found for your hotel.
                </td>
              </tr>
            ) : (
              dashboardData.bookings.map((item, index) => (
                <tr key={index}>
                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300">
                    {item.user?.username || "Guest User"}
                  </td>

                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300 max-sm:hidden">
                    {item.user?.roomType || "Room"}
                  </td>

                  <td className="py-3 px-4 text-gray-700 border-t border-gray-300 text-center">
                    $ {item.totalPrice}
                  </td>

                  <td className="py-3 px-4 border-t border-gray-300">
                    <button
                      className={`py-1 px-3 text-xs rounded-full block mx-auto ${
                        item.status === "cancelled"
                          ? "bg-red-100 text-red-600"
                          : item.isPaid
                          ? "bg-green-100 text-green-600"
                          : "bg-amber-100 text-yellow-600"
                      }`}
                    >
                      {item.status === "cancelled"
                        ? "Cancelled"
                        : item.isPaid
                        ? "Completed"
                        : "Pending"}
                    </button>
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

export default Dashboard;