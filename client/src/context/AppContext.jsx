import React, { createContext, useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";

export const AppContext = createContext();

export const AppContextProvider = ({ children }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const { user } = useUser();

  const [rooms, setRooms] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [myHotel, setMyHotel] = useState(null);
  const [myRooms, setMyRooms] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showHotelReg, setShowHotelReg] = useState(false);

  // Authenticated fetch helper
  const fetchWithAuth = async (endpoint, options = {}) => {
    const url = `${backendUrl}${endpoint}`;
    const headers = options.headers || {};

    if (user) {
      headers["userid"] = user.id;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }
    return data;
  };

  // Sync Clerk User with MongoDB
  const syncClerkUser = async () => {
    if (!user) return;
    try {
      const email = user.emailAddresses[0]?.emailAddress;
      const username = user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Guest User";
      const image = user.imageUrl;

      const data = await fetch(`${backendUrl}/api/users/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clerkId: user.id,
          username,
          email,
          image,
        }),
      }).then((res) => res.json());

      if (data.success) {
        setUserProfile(data.user);
      }
    } catch (error) {
      console.error("Error syncing user:", error);
    }
  };

  // Fetch all rooms from the backend with optional filters
  const fetchRooms = async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.roomTypes) params.append("roomTypes", filters.roomTypes);
      if (filters.priceRanges) params.append("priceRanges", filters.priceRanges);
      if (filters.sort) params.append("sort", filters.sort);
      if (filters.city) params.append("city", filters.city);

      const data = await fetchWithAuth(`/api/rooms/list?${params.toString()}`);
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Room by ID
  const fetchRoomById = async (roomId) => {
    try {
      const data = await fetchWithAuth(`/api/rooms/${roomId}`);
      return data.success ? data.room : null;
    } catch (error) {
      console.error("Error fetching room details:", error);
      return null;
    }
  };

  // Register a Hotel
  const registerHotel = async (hotelData) => {
    try {
      const data = await fetchWithAuth("/api/hotels/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hotelData),
      });
      if (data.success) {
        setMyHotel(data.hotel);
        await syncClerkUser(); // refresh user role
        return { success: true, message: data.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Fetch registered hotel details
  const fetchMyHotel = async () => {
    try {
      const data = await fetchWithAuth("/api/hotels/my-hotel");
      if (data.success) {
        setMyHotel(data.hotel);
      }
    } catch (error) {
      console.error("Error fetching my hotel:", error);
    }
  };

  // Fetch owner's rooms
  const fetchMyRooms = async () => {
    try {
      const data = await fetchWithAuth("/api/rooms/my-rooms");
      if (data.success) {
        setMyRooms(data.rooms);
      }
    } catch (error) {
      console.error("Error fetching my rooms:", error);
    }
  };

  // Add a new Room
  const addRoom = async (formData) => {
    try {
      // Note: formData should be a Multipart/Form-Data object containing files
      const data = await fetchWithAuth("/api/rooms/add", {
        method: "POST",
        body: formData, // fetch will auto set multipart content-type boundary
      });
      if (data.success) {
        await fetchMyRooms();
        return { success: true, message: data.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Toggle availability of a room
  const toggleRoomAvailability = async (roomId) => {
    try {
      const data = await fetchWithAuth(`/api/rooms/toggle/${roomId}`, {
        method: "PATCH",
      });
      if (data.success) {
        await fetchMyRooms();
        return { success: true, message: data.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Create booking
  const createBooking = async (bookingData) => {
    try {
      const data = await fetchWithAuth("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });
      if (data.success) {
        await fetchUserBookings();
        return { success: true, message: data.message, booking: data.booking };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Fetch user bookings
  const fetchUserBookings = async () => {
    try {
      const data = await fetchWithAuth("/api/bookings/my-bookings");
      if (data.success) {
        setMyBookings(data.bookings);
      }
    } catch (error) {
      console.error("Error fetching user bookings:", error);
    }
  };

  // Cancel Booking
  const cancelBooking = async (bookingId) => {
    try {
      const data = await fetchWithAuth(`/api/bookings/cancel/${bookingId}`, {
        method: "PATCH",
      });
      if (data.success) {
        await fetchUserBookings();
        return { success: true, message: data.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Pay Booking
  const payBooking = async (bookingId) => {
    try {
      const data = await fetchWithAuth(`/api/bookings/pay/${bookingId}`, {
        method: "PATCH",
      });
      if (data.success) {
        await fetchUserBookings();
        return { success: true, message: data.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Fetch owner dashboard statistics
  const fetchDashboardData = async () => {
    try {
      const data = await fetchWithAuth("/api/bookings/dashboard");
      if (data.success) {
        setDashboardData({
          totalBookings: data.totalBookings,
          totalRevenue: data.totalRevenue,
          bookings: data.bookings,
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  // Sync user profile when user logs in/changes
  useEffect(() => {
    if (user) {
      syncClerkUser();
    } else {
      setUserProfile(null);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    fetchRooms();
  }, []);

  return (
    <AppContext.Provider
      value={{
        backendUrl,
        userProfile,
        rooms,
        myBookings,
        myHotel,
        myRooms,
        dashboardData,
        loading,
        showHotelReg,
        setShowHotelReg,
        syncClerkUser,
        fetchRooms,
        fetchRoomById,
        registerHotel,
        fetchMyHotel,
        fetchMyRooms,
        addRoom,
        toggleRoomAvailability,
        createBooking,
        fetchUserBookings,
        cancelBooking,
        payBooking,
        fetchDashboardData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
