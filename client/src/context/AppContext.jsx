import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useUser, useAuth } from "@clerk/clerk-react";

// Note: keep this file exporting the Provider component only to preserve fast refresh.
const AppContext = createContext();

const AppContextProvider = ({ children }) => {
  // Production backend URL - falls back to localhost for local dev
  const backendUrl = import.meta.env.VITE_BACKEND_URL
    || (typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? "https://hotel-booking-website-m3wn.vercel.app"
      : "http://localhost:3000");
  const { user } = useUser();
  const { getToken } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [roomsError, setRoomsError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [myHotel, setMyHotel] = useState(null);
  const [myRooms, setMyRooms] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showHotelReg, setShowHotelReg] = useState(false);

  // Hotel listings (multi-hotel feature)
  const [hotels, setHotels] = useState([]);
  const [hotelsPagination, setHotelsPagination] = useState(null);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [hotelsError, setHotelsError] = useState(null);
  const [myHotels, setMyHotels] = useState([]);
  const [myHotelsLoading, setMyHotelsLoading] = useState(false);
  const [myHotelsError, setMyHotelsError] = useState(null);

  // ---------------------------------------------------------------------------
  // Stable identity for the auth helper
  //
  // Every API helper below is memoised with useCallback so that its identity
  // only changes when something it really depends on changes. Pages call these
  // helpers from a useEffect; if the identity changed on every provider render
  // the effect would re-run, re-trigger the request, re-render the provider and
  // start an endless request loop (the hotel images flickered because of it).
  //
  // The Clerk session and the backend URL are read through a ref so that
  // `fetchWithAuth` itself can stay stable for the lifetime of the provider.
  // ---------------------------------------------------------------------------
  const authRef = useRef({ backendUrl, user, getToken });

  useEffect(() => {
    authRef.current = { backendUrl, user, getToken };
  }, [backendUrl, user, getToken]);

  // Debug logging - visible in browser console (once per backend URL change)
  useEffect(() => {
    console.log("[QuickStay] Backend URL:", backendUrl);
    if (!import.meta.env.VITE_BACKEND_URL) {
      console.warn("[QuickStay] VITE_BACKEND_URL not set! Falling back to localhost. Set this in Vercel Environment Variables.");
    }
  }, [backendUrl]);

  // Authenticated fetch helper
  const fetchWithAuth = useCallback(async (endpoint, options = {}) => {
    const { backendUrl: baseUrl, user: currentUser, getToken: currentGetToken } =
      authRef.current;

    const url = `${baseUrl}${endpoint}`;
    const headers = { ...(options.headers || {}) };

    // Send the Clerk session JWT so the server can verify who we are. The
    // server no longer trusts a plain user id header.
    if (currentUser) {
      try {
        const token = await currentGetToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error("[QuickStay] Could not get Clerk session token:", error);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // The API always answers with JSON, but a proxy/hosting error page would
    // not - handle that gracefully instead of throwing a parser error.
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(
        data?.message || `Request failed with status ${response.status}`
      );
      error.status = response.status;
      // The API reports field level problems as `details` (Mongoose
      // validation errors are mapped to `{ field: message }`).
      error.errors = data?.details || data?.errors || null;
      throw error;
    }
    return data;
  }, []);

  // Sync Clerk User with MongoDB
  const syncClerkUser = useCallback(async () => {
    const currentUser = authRef.current.user;
    if (!currentUser) return;
    try {
      const email = currentUser.emailAddresses[0]?.emailAddress;
      const username = currentUser.fullName || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "Guest User";
      const image = currentUser.imageUrl;

      const data = await fetchWithAuth("/api/users/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          image,
        }),
      });

      if (data.success) {
        setUserProfile(data.user);
      }
    } catch (error) {
      console.error("Error syncing user:", error);
    }
  }, [fetchWithAuth]);

  // Fetch all rooms from the backend with optional filters
  const fetchRooms = useCallback(async (filters = {}) => {
    setLoading(true);
    setRoomsError(null);
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
      // Surface the failure so the UI can say "server unreachable" instead of
      // silently rendering "No rooms match your filter."
      setRoomsError(
        error.message === "Failed to fetch"
          ? `Cannot reach the server at ${backendUrl}. Is the backend running?`
          : error.message || "Failed to load rooms"
      );
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, backendUrl]);

  // Fetch Room by ID
  const fetchRoomById = useCallback(async (roomId) => {
    try {
      // Use direct fetch (no auth required for public room details endpoint)
      const res = await fetch(`${backendUrl}/api/rooms/${roomId}`);
      const data = await res.json();
      if (data.success) {
        return data.room;
      }
      // Surface the actual server error message
      throw new Error(data.message || "Room not found");
    } catch (error) {
      console.error("Error fetching room details:", error);
      throw error; // re-throw so RoomDetails can catch and show it
    }
  }, [backendUrl]);

  // Fetch user's bookings (declared before the helpers that refresh them)
  const fetchUserBookings = useCallback(async () => {
    try {
      const data = await fetchWithAuth("/api/bookings/my-bookings");
      if (data.success) {
        setMyBookings(data.bookings);
      }
    } catch (error) {
      console.error("Error fetching user bookings:", error);
    }
  }, [fetchWithAuth]);

  // Register a Hotel
  const registerHotel = useCallback(async (hotelData) => {
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
  }, [fetchWithAuth, syncClerkUser]);

  // Fetch registered hotel details
  const fetchMyHotel = useCallback(async () => {
    try {
      const data = await fetchWithAuth("/api/hotels/my-hotel");
      if (data.success) {
        setMyHotel(data.hotel);
      }
    } catch (error) {
      console.error("Error fetching my hotel:", error);
    }
  }, [fetchWithAuth]);

  // Fetch owner's rooms (optionally limited to one hotel)
  const fetchMyRooms = useCallback(async (hotelId) => {
    try {
      const query = hotelId ? `?hotelId=${encodeURIComponent(hotelId)}` : "";
      const data = await fetchWithAuth(`/api/rooms/my-rooms${query}`);
      if (data.success) {
        setMyRooms(data.rooms);
      }
    } catch (error) {
      console.error("Error fetching my rooms:", error);
    }
  }, [fetchWithAuth]);

  // Add a new Room
  const addRoom = useCallback(async (formData) => {
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
  }, [fetchWithAuth, fetchMyRooms]);

  // Toggle availability of a room
  const toggleRoomAvailability = useCallback(async (roomId) => {
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
  }, [fetchWithAuth, fetchMyRooms]);

  // Create booking
  const createBooking = useCallback(async (bookingData) => {
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
  }, [fetchWithAuth, fetchUserBookings]);

  // Cancel Booking
  const cancelBooking = useCallback(async (bookingId) => {
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
  }, [fetchWithAuth, fetchUserBookings]);

  // Pay Booking
  const payBooking = useCallback(async (bookingId, paymentMethod) => {
    try {
      const data = await fetchWithAuth(`/api/bookings/pay/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });
      if (data.success) {
        await fetchUserBookings();
        return { success: true, message: data.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchWithAuth, fetchUserBookings]);

  // Fetch owner dashboard statistics
  const fetchDashboardData = useCallback(async () => {
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
  }, [fetchWithAuth]);

  // -------------------------------------------------------------------------
  // Hotels (multi-hotel listings)
  // -------------------------------------------------------------------------

  // Public hotel search. The server only returns approved listings.
  const fetchHotels = useCallback(async (filters = {}) => {
    setHotelsLoading(true);
    setHotelsError(null);
    try {
      const params = new URLSearchParams();
      if (filters.city) params.append("city", filters.city);
      if (filters.category) {
        params.append(
          "category",
          Array.isArray(filters.category) ? filters.category.join(",") : filters.category
        );
      }
      if (filters.amenities) {
        params.append(
          "amenities",
          Array.isArray(filters.amenities) ? filters.amenities.join(",") : filters.amenities
        );
      }
      if (filters.minPrice !== undefined && filters.minPrice !== "") {
        params.append("minPrice", filters.minPrice);
      }
      if (filters.maxPrice !== undefined && filters.maxPrice !== "") {
        params.append("maxPrice", filters.maxPrice);
      }
      if (filters.checkIn) params.append("checkIn", filters.checkIn);
      if (filters.checkOut) params.append("checkOut", filters.checkOut);
      if (filters.sort) params.append("sort", filters.sort);
      if (filters.page) params.append("page", filters.page);
      if (filters.limit) params.append("limit", filters.limit);

      const query = params.toString();
      const data = await fetchWithAuth(`/api/hotels${query ? `?${query}` : ""}`);
      if (data?.success) {
        setHotels(data.hotels || []);
        setHotelsPagination(data.pagination || null);
      }
      return data;
    } catch (error) {
      setHotels([]);
      setHotelsPagination(null);
      setHotelsError(error.message || "Failed to load hotels");
      return null;
    } finally {
      setHotelsLoading(false);
    }
  }, [fetchWithAuth]);

  // Hotel details. Unapproved listings are only visible to their owner/admin.
  const fetchHotelById = useCallback(async (hotelId, { checkIn, checkOut } = {}) => {
    const params = new URLSearchParams();
    if (checkIn) params.append("checkIn", checkIn);
    if (checkOut) params.append("checkOut", checkOut);
    const query = params.toString();

    const data = await fetchWithAuth(
      `/api/hotels/${hotelId}${query ? `?${query}` : ""}`
    );
    if (!data?.success) {
      throw new Error(data?.message || "Hotel not found");
    }
    return data;
  }, [fetchWithAuth]);

  // Every hotel the signed in user manages.
  const fetchMyHotels = useCallback(async () => {
    setMyHotelsLoading(true);
    setMyHotelsError(null);
    try {
      const data = await fetchWithAuth("/api/hotels/my-hotels");
      if (data?.success) {
        setMyHotels(data.hotels || []);
      }
      return data;
    } catch (error) {
      setMyHotelsError(error.message || "Failed to load your hotels");
      return null;
    } finally {
      setMyHotelsLoading(false);
    }
  }, [fetchWithAuth]);

  // Create a listing. The server always creates it as "pending".
  const createHotel = useCallback(async (hotelData) => {
    try {
      const data = await fetchWithAuth("/api/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hotelData),
      });
      // The first listing promotes the account to hotelOwner.
      await syncClerkUser();
      await fetchMyHotels();
      return { success: true, message: data.message, hotel: data.hotel };
    } catch (error) {
      return { success: false, message: error.message, errors: error.errors };
    }
  }, [fetchWithAuth, syncClerkUser, fetchMyHotels]);

  // Update a listing (owner or admin only - enforced server side).
  const updateHotel = useCallback(async (hotelId, hotelData) => {
    try {
      const data = await fetchWithAuth(`/api/hotels/${hotelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hotelData),
      });
      await fetchMyHotels();
      return { success: true, message: data.message, hotel: data.hotel };
    } catch (error) {
      return { success: false, message: error.message, errors: error.errors };
    }
  }, [fetchWithAuth, fetchMyHotels]);

  // Delete a listing. Hotels with active bookings need an admin + force flag.
  const deleteHotel = useCallback(async (hotelId, { force = false } = {}) => {
    try {
      const data = await fetchWithAuth(
        `/api/hotels/${hotelId}${force ? "?force=true" : ""}`,
        { method: "DELETE" }
      );
      await fetchMyHotels();
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, message: error.message, errors: error.errors };
    }
  }, [fetchWithAuth, fetchMyHotels]);

  // Admin listing overview.
  const fetchAdminHotels = useCallback(async ({ status, search, page, limit } = {}) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (search) params.append("search", search);
    if (page) params.append("page", page);
    if (limit) params.append("limit", limit);
    const query = params.toString();
    return fetchWithAuth(`/api/hotels/admin/all${query ? `?${query}` : ""}`);
  }, [fetchWithAuth]);

  // Approve a listing.
  const approveHotel = useCallback(async (hotelId) => {
    try {
      const data = await fetchWithAuth(`/api/hotels/${hotelId}/approve`, {
        method: "PATCH",
      });
      return { success: true, message: data.message, hotel: data.hotel };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchWithAuth]);

  // Reject a listing (a reason is required by the API).
  const rejectHotel = useCallback(async (hotelId, reason) => {
    try {
      const data = await fetchWithAuth(`/api/hotels/${hotelId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      return { success: true, message: data.message, hotel: data.hotel };
    } catch (error) {
      return { success: false, message: error.message, errors: error.errors };
    }
  }, [fetchWithAuth]);

  // Upload hotel photos (multipart/form-data, field name "images").
  const uploadHotelImages = useCallback(async (hotelId, formData) => {
    try {
      const data = await fetchWithAuth(`/api/hotels/${hotelId}/images`, {
        method: "POST",
        body: formData,
      });
      return {
        success: true,
        message: data.message,
        images: data.images,
        imageIds: data.imageIds,
        warnings: data.warnings,
      };
    } catch (error) {
      return { success: false, message: error.message, errors: error.errors };
    }
  }, [fetchWithAuth]);

  // Remove one hotel photo.
  const removeHotelImage = useCallback(async (hotelId, index) => {
    try {
      const data = await fetchWithAuth(`/api/hotels/${hotelId}/images/${index}`, {
        method: "DELETE",
      });
      return { success: true, message: data.message, images: data.images };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchWithAuth]);

  // Geocoding proxy (never call the provider from the browser).
  const geocodeAddress = useCallback(async (query) => {
    const data = await fetchWithAuth(
      `/api/hotels/geocode?q=${encodeURIComponent(query)}`
    );
    if (!data?.success) throw new Error(data?.message || "Location search failed");
    return data;
  }, [fetchWithAuth]);

  // Reverse geocoding: coordinates -> address.
  const reverseGeocode = useCallback(async (latitude, longitude) => {
    const data = await fetchWithAuth(
      `/api/hotels/reverse-geocode?lat=${latitude}&lon=${longitude}`
    );
    if (!data?.success) throw new Error(data?.message || "Location search failed");
    return data.result;
  }, [fetchWithAuth]);

  // Rooms of a single hotel.
  const fetchHotelRooms = useCallback(async (hotelId) => {
    const data = await fetchWithAuth(`/api/rooms/hotel/${hotelId}`);
    if (!data?.success) throw new Error(data?.message || "Failed to load rooms");
    return data;
  }, [fetchWithAuth]);

  // Inventory per room type (with availability for the given dates).
  const fetchHotelRoomTypes = useCallback(async (hotelId, { checkIn, checkOut } = {}) => {
    const params = new URLSearchParams();
    if (checkIn) params.append("checkIn", checkIn);
    if (checkOut) params.append("checkOut", checkOut);
    const query = params.toString();
    const data = await fetchWithAuth(
      `/api/rooms/hotel/${hotelId}/types${query ? `?${query}` : ""}`
    );
    if (!data?.success) throw new Error(data?.message || "Failed to load room types");
    return data;
  }, [fetchWithAuth]);

  // Availability of a single room for a date range.
  const checkRoomAvailability = useCallback(async (roomId, { checkIn, checkOut } = {}) => {
    const params = new URLSearchParams();
    if (checkIn) params.append("checkIn", checkIn);
    if (checkOut) params.append("checkOut", checkOut);
    const query = params.toString();
    return fetchWithAuth(
      `/api/rooms/availability/${roomId}${query ? `?${query}` : ""}`
    );
  }, [fetchWithAuth]);

  // Update a room.
  const updateRoom = useCallback(async (roomId, roomData) => {
    try {
      const data = await fetchWithAuth(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roomData),
      });
      await fetchMyRooms();
      return { success: true, message: data.message, room: data.room };
    } catch (error) {
      return { success: false, message: error.message, errors: error.errors };
    }
  }, [fetchWithAuth, fetchMyRooms]);

  // Delete a room (blocked while the room has active bookings).
  const deleteRoom = useCallback(async (roomId) => {
    try {
      const data = await fetchWithAuth(`/api/rooms/${roomId}`, { method: "DELETE" });
      await fetchMyRooms();
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchWithAuth, fetchMyRooms]);

  // Sync user profile when user logs in/changes.
  // Depend on the user id (not the object) so a re-render never re-syncs.
  const userId = user?.id;
  useEffect(() => {
    if (userId) {
      syncClerkUser();
    } else {
      setUserProfile(null);
    }
  }, [userId, syncClerkUser]);

  // Initial load
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const contextValue = useMemo(
    () => ({
      backendUrl,
      userProfile,
      rooms,
      roomsError,
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
      // Hotels
      hotels,
      hotelsPagination,
      hotelsLoading,
      hotelsError,
      myHotels,
      myHotelsLoading,
      myHotelsError,
      fetchHotels,
      fetchHotelById,
      createHotel,
      updateHotel,
      deleteHotel,
      fetchMyHotels,
      fetchAdminHotels,
      approveHotel,
      rejectHotel,
      uploadHotelImages,
      removeHotelImage,
      geocodeAddress,
      reverseGeocode,
      // Rooms
      fetchHotelRooms,
      fetchHotelRoomTypes,
      checkRoomAvailability,
      updateRoom,
      deleteRoom,
    }),
    [
      backendUrl,
      userProfile,
      rooms,
      roomsError,
      myBookings,
      myHotel,
      myRooms,
      dashboardData,
      loading,
      showHotelReg,
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
      hotels,
      hotelsPagination,
      hotelsLoading,
      hotelsError,
      myHotels,
      myHotelsLoading,
      myHotelsError,
      fetchHotels,
      fetchHotelById,
      createHotel,
      updateHotel,
      deleteHotel,
      fetchMyHotels,
      fetchAdminHotels,
      approveHotel,
      rejectHotel,
      uploadHotelImages,
      removeHotelImage,
      geocodeAddress,
      reverseGeocode,
      fetchHotelRooms,
      fetchHotelRoomTypes,
      checkRoomAvailability,
      updateRoom,
      deleteRoom,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export { AppContext, AppContextProvider };
export default AppContextProvider;
