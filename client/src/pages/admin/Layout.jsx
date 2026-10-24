import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../../components/hotelOwner/Navbar";
import Sidebar from "../../components/hotelOwner/Sidebar";

/**
 * Layout of the admin panel. It reuses the dashboard shell of the owner area
 * so that both panels look and behave the same way.
 */
const Layout = () => {
  return (
    <div className="flex flex-col min-h-screen" style={{ minHeight: "100dvh" }}>
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 p-4 pt-10 md:px-10 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
