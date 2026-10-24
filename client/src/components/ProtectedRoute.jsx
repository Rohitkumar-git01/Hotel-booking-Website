import React, { useContext } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import LoadingSpinner from "./LoadingSpinner";

/**
 * Route guard for role protected pages.
 *
 * The role comes from the backend (`/api/users/sync` -> `userProfile.role`),
 * never from the client, so the guard only improves the UX - the API
 * enforces the real permissions.
 *
 * @param {string[]} roles  roles that may open the route ("*" = any signed in user)
 */
const ProtectedRoute = ({ roles = [], children }) => {
  const { isSignedIn, isLoading: authLoading } = useAuth();
  const { user } = useUser();
  const { userProfile } = useContext(AppContext);
  const location = useLocation();

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (!isSignedIn || !user) {
    // Send the visitor back to the home page after signing in.
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // The profile is synced right after sign in - give it a moment.
  if (!userProfile) {
    return <LoadingSpinner />;
  }

  const allowed = roles.includes("*") || roles.includes(userProfile.role);
  if (!allowed) {
    return (
      <div className="pt-32 px-4 pb-16 text-center">
        <h1 className="font-playfair text-3xl text-gray-800">Access denied</h1>
        <p className="text-gray-500 mt-3 max-w-lg mx-auto">
          Your account does not have permission to open this page. If you believe this is a
          mistake, contact the platform administrator.
        </p>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
