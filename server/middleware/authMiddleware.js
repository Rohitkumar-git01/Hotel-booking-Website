import User from "../models/User.js";
import { createRemoteJWKSet, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// Clerk session token verification
//
// The client sends the Clerk session JWT as `Authorization: Bearer <token>`.
// We verify its signature against Clerk's public JWKS and read the Clerk user
// id from the `sub` claim. The old implementation trusted a `userid` header,
// which let anyone impersonate any user by guessing an id.
//
// The JWKS URL is derived from the Clerk *publishable* key, which encodes the
// instance's frontend API host: pk_(test|live)_<base64("host$")>. Verifying a
// token only needs public keys, so no secret key is required here.
// ---------------------------------------------------------------------------

let jwks = null;
let issuer = null;

const resolveIssuer = () => {
  if (process.env.CLERK_ISSUER) {
    return process.env.CLERK_ISSUER.trim().replace(/\/+$/, "");
  }

  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || "";

  const match = /^pk_(?:test|live)_(.+)$/.exec(publishableKey.trim());
  if (!match) return null;

  let host;
  try {
    host = Buffer.from(match[1], "base64").toString("utf8").replace(/\$$/, "").trim();
  } catch {
    return null;
  }

  if (!host) return null;
  return host.startsWith("http") ? host.replace(/\/+$/, "") : `https://${host}`;
};

const getJwks = () => {
  if (!jwks) {
    issuer = resolveIssuer();
    if (!issuer) {
      throw new Error(
        "Clerk is not configured on the server. Set CLERK_PUBLISHABLE_KEY (or CLERK_ISSUER) in the server environment."
      );
    }
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return jwks;
};

const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim() || null;
};

// Returns the Clerk user id (token `sub`) or throws.
const verifySessionToken = async (token) => {
  const remoteJwks = getJwks();
  const { payload } = await jwtVerify(token, remoteJwks, {
    issuer: issuer || resolveIssuer(),
  });

  if (!payload.sub) throw new Error("Session token has no subject");
  return payload.sub;
};

const isConfigError = (error) => /not configured/i.test(error?.message || "");

// Protect routes that require a signed-in user.
export const protect = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, no session token provided" });
    }

    let clerkId;
    try {
      clerkId = await verifySessionToken(token);
    } catch (error) {
      if (isConfigError(error)) {
        console.error("Auth Configuration Error:", error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.status(401).json({ success: false, message: "Not authorized, invalid or expired session token" });
    }

    const user = await User.findById(clerkId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found in database" });
    }

    req.userId = clerkId;
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ success: false, message: "Server auth error", error: error.message });
  }
};

// Attach the user when a valid token is present, but still allow guests.
// Used by public endpoints that personalise their response (e.g. the chatbot).
export const optionalAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (token) {
      try {
        const clerkId = await verifySessionToken(token);
        const user = await User.findById(clerkId);
        if (user) {
          req.userId = clerkId;
          req.user = user;
        }
      } catch (error) {
        // An absent/expired token just means "guest" here. Never fall back to
        // an id supplied in another header, though.
        if (isConfigError(error)) {
          console.error("Auth Configuration Error:", error.message);
        }
      }
    }
    next();
  } catch (error) {
    console.error("Optional Auth Middleware Error:", error);
    next();
  }
};

// Middleware to authorize hotel owner routes.
// Admins are allowed as well: they manage rooms belonging to any hotel.
export const isOwner = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }
    if (!["hotelOwner", "admin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied. Only hotel owners are allowed" });
    }
    next();
  } catch (error) {
    console.error("Owner Authorization Error:", error);
    res.status(500).json({ success: false, message: "Server authorization error" });
  }
};

// Middleware to authorize admin-only routes (approval dashboard, moderation).
export const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied. Admin privileges are required" });
    }
    next();
  } catch (error) {
    console.error("Admin Authorization Error:", error);
    res.status(500).json({ success: false, message: "Server authorization error" });
  }
};

// True when the authenticated user may act on a resource owned by `ownerId`.
export const canActOnHotel = (user, ownerId) =>
  Boolean(user) && (user.role === "admin" || user._id === ownerId);

