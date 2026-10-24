# QuickStay — Multi-Hotel Listing System · Delivery Report

**Repository:** `hotel-booking` (MERN) · **Branch:** `main`
**Status:** Implementation complete and verified locally. See [Known limitations](#10-known-limitations--untested-areas) for the parts that could not be exercised on this machine.

---

## 1. Summary

QuickStay was a single-hotel room-booking app (one owner, one hotel, Clerk auth, Cloudinary uploads, per-unit rooms). It is now a **multi-hotel listing platform** with three roles, an admin approval workflow, an interactive map, per-hotel room inventory and a public search — **without replacing** the existing room/booking model or the Clerk authentication.

### What was added

| Area | Capability |
| --- | --- |
| **RBAC** | `user` (customer), `hotelOwner`, `admin`. Roles are read from the database, never from the client. Owners manage *many* hotels; admins manage *all*. |
| **Approval workflow** | Every new listing is created `pending` and is invisible to customers until an admin approves it. Rejections carry a reason the owner can act on. Material owner edits send an approved listing back to `pending`. |
| **Hotels** | Full listing: name, description, category, address, city/state/country/PIN, lat/lng, phone/email, amenities, check-in/out times, photos, owner, approval status, timestamps. |
| **Map** | React-Leaflet + OpenStreetMap. Address search, click-to-place, draggable marker, coordinates stored *and* mirrored as GeoJSON, map on the details page, one-click directions, backend-geocoding proxy. |
| **Rooms** | Preserved per-unit model: one `Room` document = one bookable unit. Rooms are now attached to a hotel, with capacity, description and availability. |
| **Search** | City, price range, amenities, property type, date availability, sorting, pagination. |
| **Images** | Cloudinary streaming upload, type/size validation, only URLs + public ids stored in MongoDB. |
| **Oversell protection** | A `BookingSlot` inventory lock per room per night with a unique index — concurrent bookings can never sell the same night twice. |
| **API hardening** | Centralised error envelope, consistent status codes, pagination, request validation. |
| **Frontend** | 8 new pages (search, details, add/edit hotel, owner dashboard, my hotels, manage rooms, admin approvals) + 6 new shared components. |

### Design decisions worth knowing

1. **Legacy hotels stay public.** `approvalStatus` deliberately has **no schema default**, so pre-existing documents keep `undefined` and remain approved. New hotels are always created `pending` by the server — a client can never request `approved`.
2. **Owner = the token, not the payload.** `req.user._id` from the verified Clerk JWT is the owner. Sending an `owner` field in the body is ignored, so spoofing another owner's hotel is impossible (covered by a test).
3. **One `Room` doc = one bookable unit.** This keeps the original per-unit model and the existing bookings intact. Inventory is simply *the number of documents of that type*.
4. **Room ↔ hotel via a required `hotel` reference.** Every room belongs to exactly one hotel; the API derives the owner from that hotel.
5. **Coordinates are stored twice, on purpose.** Scalar `latitude`/`longitude` (easy to query and to read) plus a GeoJSON `location` Point in `[longitude, latitude]` order, kept in sync by a `pre("save")` hook.
6. **Geocoding is proxied.** The browser never talks to Nominatim: the backend sends a descriptive `User-Agent` and enforces ≤1 req/s. No provider configuration or key reaches the client bundle.
7. **Uploads stream from memory.** Multer `memoryStorage` → Cloudinary `upload_stream`. Vercel's filesystem is read-only, and disk storage also left temp files behind.
8. **Every API helper is referentially stable.** `AppContext` wraps all helpers in `useCallback` and the provider value in `useMemo`, and the Clerk session is read through a ref. Pages call these helpers from a `useEffect`; unstable identities made the effect re-fire on every provider render, which produced an endless request loop (see §5.6).

---

## 1a. Bug fix — flickering hotel images

**Symptom:** opening the *Hotels* section made the hotel photos flash on and off.

**Root cause:** an infinite render/request loop, not an image bug.

1. `AppContext` declared every API helper as a plain function, so each provider render produced **new function identities**.
2. `HotelSearch` loaded data from `useEffect(() => { load(); }, [load])`, where `load` depended on `fetchHotels`.
3. `fetchHotels` called `setHotelsLoading(true)` → provider re-render → new `fetchHotels` → new `load` → effect re-runs → `fetchHotels` again → …

Each cycle swapped the results grid for the "Loading hotels…" placeholder and back, so the `<img>` elements were unmounted and re-created and re-downloaded — the visible flicker. The same loop hammered the API (it also burned serverless invocations on Vercel).

**Measured before:** `GET /api/hotels` fired **96 times in 9 seconds** on `/hotels` (180 requests total).

**Fix**

| Change | File |
| --- | --- |
| `fetchWithAuth` → `useCallback` with the Clerk session/backend URL read from a ref (identity never changes). | `client/src/context/AppContext.jsx` |
| All 30+ API helpers → `useCallback` with their real dependencies. | `client/src/context/AppContext.jsx` |
| Provider value → `useMemo`; the backend-URL debug log moved into an effect so it no longer spams the console. | `client/src/context/AppContext.jsx` |
| The Clerk sync effect now depends on `user.id` instead of the user object. | `client/src/context/AppContext.jsx` |
| URL syncing split out of the fetch callback — `setSearchParams` gets a new identity whenever the query string changes, which caused a second, redundant request. | `client/src/pages/hotels/HotelSearch.jsx` |
| The results grid stays mounted during a refetch (the loader is only shown when there is nothing to display yet) so the images are never torn down. | `client/src/pages/hotels/HotelSearch.jsx` |
| `class=` → `className=` in the newsletter (React console error on every page that renders it). | `client/src/components/NewsLetter.jsx` |
| Effects now list the (now stable) helpers as dependencies — `AllRooms`, `MyBookings`, `RoomDetails`, `Dashboard`. | `client/src/pages/…` |

**Measured after:** **1 request** for `/api/hotels` (and every other page makes 1–2 requests, which is its real workload). Verified on the Vite dev server *and* on the production `vite preview` build.

---

## 2. Complete file list

### 2.1 Backend — new files

| File | Purpose |
| --- | --- |
| `server/utils/constants.js` | Single source of truth for categories, amenities, room types, approval statuses, page sizes, upload limits. |
| `server/utils/httpError.js` | `HttpError` + `badRequest` / `forbidden` / `notFound` / `conflict` helpers. |
| `server/utils/cloudinary.js` | `upload_stream` upload, `publicIdFromUrl`, `destroyImage`. |
| `server/utils/geocode.js` | Nominatim forward/reverse proxy with descriptive UA and error handling. |
| `server/middleware/errorMiddleware.js` | `notFoundHandler` + central `errorHandler` (JSON envelope, mongoose/multer/duplicate-key mapping). |
| `server/middleware/rateLimitMiddleware.js` | 1-request-per-second limiter for the geocoding proxy. |
| `server/models/BookingSlot.js` | Inventory lock: `{ room, date }` with a **unique** compound index. |
| `server/scripts/migrate.js` | Idempotent backfill + index creation (`npm run migrate`, `--dry-run`). |
| `server/tests/api.test.js` | 33 integration tests against a real MongoDB. |
| `server/.env.example` | Documented environment variables, no secrets. |

### 2.2 Backend — modified files

| File | Change |
| --- | --- |
| `server/models/Hotel.js` | Extended schema (description, category, state, country, postalCode, lat/lng, contact, contactEmail, amenities, check-in/out, images, imageIds, owner, approvalStatus, approvedAt, rejectionReason), `location` GeoJSON sub-schema, `approvedHotelFilter()` helper, `pre("save")` `syncLocation` hook. |
| `server/models/Room.js` | `capacity` (default 2), `description`, `imageIds`, required `hotel` reference. |
| `server/models/Booking.js` | Added `checkInDate`/`checkOutDate` semantics + slot references. |
| `server/models/User.js` | `admin` role support + `ADMIN_USER_IDS` promotion. |
| `server/controllers/hotelController.js` | New: `createHotel`, `updateHotel`, `deleteHotel`, `getMyHotels`, `getMyHotel`, `getAdminHotels`, `approveHotel`, `rejectHotel`, `uploadHotelImages`, `removeHotelImage`, `geocode`, `reverseGeocodeHandler`; rewritten `getHotels` (search) and `getHotelById`. |
| `server/controllers/roomController.js` | Hotel-scoped CRUD, `getHotelRooms`, `getHotelRoomTypes`, `checkRoomAvailability`, inventory-aware availability. |
| `server/controllers/bookingController.js` | Atomic slot-based `createBooking`, cancel releases slots, double-booking → 409. |
| `server/controllers/userController.js` | Role sync incl. admin promotion. |
| `server/middleware/authMiddleware.js` | `isAdmin`, `isOwner`, `canActOnHotel`, hardened `protect`/`optionalAuth`. |
| `server/middleware/uploadMiddleware.js` | Memory storage, image-only filter, 5 MB / 10-file limits. |
| `server/routes/hotelRoutes.js` | New REST surface (order matters: `/my-hotels`, `/admin/all`, `/geocode` before `/:id`). |
| `server/routes/roomRoutes.js` | Hotel-scoped routes + availability. |
| `server/routes/bookingRoutes.js` | Slot-aware booking routes. |
| `server/routes/userRoutes.js` | Role sync endpoint. |
| `server/server.js` | `CLIENT_URL` CORS allowlist, centralised error handlers, `notFoundHandler`. |
| `server/configs/db.js` | Richer seed data, `SKIP_SEED`, **`MONGODB_DB_NAME` support** (test isolation). |
| `server/package.json` | `migrate` and `test` scripts. |

### 2.3 Frontend — new files

| File | Purpose |
| --- | --- |
| `client/src/constants/hotels.js` | Categories, amenities, room types, sort options, approval metadata (badge + description). |
| `client/src/utils/map.js` | Tile URL/attribution (env-overridable), `L.divIcon` marker, `getDirectionsUrl`. |
| `client/src/components/ProtectedRoute.jsx` | Role guard for `/owner/*` and `/admin/*`. |
| `client/src/components/HotelMap.jsx` | Read-only map for the details page. |
| `client/src/components/hotelOwner/HotelForm.jsx` | Shared add/edit listing form. |
| `client/src/components/hotelOwner/LocationPicker.jsx` | Search / click / drag location picker. |
| `client/src/components/hotelOwner/ImageUploader.jsx` | Photo picker with type/size validation + previews. |
| `client/src/components/hotelOwner/ConfirmDialog.jsx` | Destructive-action confirmation. |
| `client/src/pages/hotels/HotelSearch.jsx` | Public search: filters, sorting, pagination. |
| `client/src/pages/hotels/HotelDetails.jsx` | Details + gallery + map + room selection + booking. |
| `client/src/pages/hotelOwner/AddHotel.jsx` | Create listing. |
| `client/src/pages/hotelOwner/EditHotel.jsx` | Edit listing + manage photos. |
| `client/src/pages/hotelOwner/MyHotels.jsx` | Owner's listings with status, stats and actions. |
| `client/src/pages/hotelOwner/ManageRooms.jsx` | Per-hotel room inventory management. |
| `client/src/pages/admin/Layout.jsx` | Admin shell (reuses the owner chrome). |
| `client/src/pages/admin/AdminHotels.jsx` | Approval dashboard (counts, filters, approve/reject). |
| `client/.env.example` | Documented environment variables, no secrets. |

### 2.4 Frontend — modified files

| File | Change |
| --- | --- |
| `client/src/App.jsx` | New routes: `/hotels`, `/hotels/:id`, `/owner/*`, `/admin/hotels`; role guards; owner/admin panels hide the public Navbar/Footer. |
| `client/src/context/AppContext.jsx` | **19 new API methods** (see §6.2), improved `fetchWithAuth` (surfaces `status` + field `details`), `fetchMyRooms(hotelId)`. All helpers memoised with `useCallback` and the provider value with `useMemo` so page effects cannot loop (§1a). |
| `client/src/components/Navbar.jsx` | "Hotels" nav entry, role-aware dashboard button (admin → `/admin/hotels`, owner → `/owner`, customer → register). |
| `client/src/components/HotelReg.jsx` | Redirects to `/owner/my-hotels` after registration. |
| `client/src/components/hotelOwner/Sidebar.jsx` | Role-aware links (owner + admin). |
| `client/src/pages/hotelOwner/AddRoom.jsx` | **Hotel selector** (required — one owner, many hotels), capacity, description, room-type dropdown. |
| `client/src/pages/hotelOwner/ListRoom.jsx` | Hotel column + "Manage" link per room. |
| `client/src/pages/hotels/HotelSearch.jsx` | URL sync split from the fetch; the results grid stays mounted during a refetch (§1a). |
| `client/src/pages/AllRooms.jsx`, `client/src/pages/MyBookings.jsx`, `client/src/pages/RoomDetails.jsx`, `client/src/pages/hotelOwner/Dashboard.jsx` | Effects now list the (now stable) context helpers as dependencies — removes the `react-hooks/exhaustive-deps` warnings and the refetch loops they caused. |
| `client/src/components/NewsLetter.jsx` | `class=` → `className=` (React console error). |
| `client/src/main.jsx` | Imports `leaflet/dist/leaflet.css`. |
| `client/src/index.css` | `.quickstay-marker` styles, Leaflet font/focus fixes. |
| `client/package.json` | `leaflet` + `react-leaflet` dependencies. |

> The complete implementation is in the files above — nothing is elided or stubbed. `git status` shows the full set of additions and modifications.

---

## 3. Environment variables

### 3.1 Server (`server/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URI` | ✅ | `mongodb://127.0.0.1:27017/hotel-booking` | Atlas or local connection string. |
| `MONGODB_DB_NAME` | | `hotel-booking` | Pinned database name. **The test suite overrides this with `quickstay-test`.** |
| `PORT` | | `3000` | API port. |
| `NODE_ENV` | | `development` | `production` hides internal error details. |
| `CLIENT_URL` | ✅ prod | *(empty)* | Comma-separated CORS allowlist, e.g. `https://quickstay.vercel.app,https://www.quickstay.app`. Empty ⇒ API is open (dev only). |
| `CLERK_PUBLISHABLE_KEY` | ✅ | — | Clerk instance key. |
| `CLERK_ISSUER` | ✅ | — | JWT issuer, usually `https://<domain>.clerk.accounts.dev`. |
| `CLERK_WEBHOOK_SECRET` | ✅ | — | Webhook signature secret. |
| `ADMIN_USER_IDS` | ✅ | *(empty)* | Comma-separated Clerk user ids promoted to `admin` on sync. |
| `HOTEL_EDITS_REQUIRE_REAPPROVAL` | | `1` | `0` keeps an approved listing approved after owner edits. |
| `CLOUDINARY_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | ✅ | — | Image storage. **Never exposed to the client.** |
| `GEOCODER_USER_AGENT` | ✅ prod | `QuickStay/1.0` | Descriptive UA — required by the Nominatim usage policy. |
| `GEOCODER_CONTACT` | | — | Your domain; sent as the `Referer` header. |
| `GEOCODER_BASE_URL` | | `https://nominatim.openstreetmap.org` | Self-hosted Nominatim alternative. |
| `SKIP_SEED` | | `0` | `1` disables the demo seed. |
| `GEMINI_API_KEY` | | — | Chatbot (pre-existing feature). |
| `MONGODB_URI_TEST` / `MONGODB_DB_NAME_TEST` | | `quickstay-test` | Test-only overrides. |
| `ALLOW_REMOTE_TEST_DB` | | — | `1` permits the test suite against a remote host. |

### 3.2 Client (`client/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | — | Clerk publishable key (embedded in the bundle — only ever the `pk_` key). |
| `VITE_BACKEND_URL` | ✅ prod | `http://localhost:3000` | API base URL. |
| `VITE_MAP_TILE_URL` | | OSM standard | Tile server; swap with `VITE_MAP_ATTRIBUTION`. |
| `VITE_MAP_ATTRIBUTION` | | OSM contributors | Required by the tile usage policy. |

### 3.3 Secret hygiene

- `server/.env` and `client/.env` are git-ignored; no env file is tracked (`git ls-files | grep env` → empty).
- Only `.env.example` files were added — placeholders only.
- No API key, Cloudinary secret, Clerk secret or MongoDB credential appears anywhere in `client/src` (verified: the client only reads `VITE_*`).
- The geocoding provider is called from the backend only.

---

## 4. Database migration

Existing hotels/rooms/bookings are **not** modified destructively.

```bash
cd server
npm run migrate              # apply
npm run migrate -- --dry-run # report only, changes nothing
```

The script is idempotent — running it twice changes nothing the second time. It:

1. **Hotels** — sets `approvalStatus: "approved"` on legacy documents that have no status (so they stay publicly visible) and records `approvedAt`.
2. **Locations** — backfills the GeoJSON `location` Point from `latitude`/`longitude` where coordinates already exist.
3. **Rooms** — sets `capacity` (default `2`) and `description` on legacy rooms.
4. **Inventory locks** — creates the `BookingSlot` documents for the nights that existing bookings already occupy, so old bookings block the same nights the new system does.
5. **Indexes** — creates the unique `{ room: 1, date: 1 }` index on `BookingSlot`, the indexes on `Hotel` (owner / approval / city) and `Room` (hotel).

Output looks like:

```
Migration summary:
  hotels marked as approved   : 1
  hotel locations backfilled   : 1
  rooms with capacity set      : 4
  inventory locks created      : 6
  inventory locks skipped      : 0
```

---

## 5. Local setup & test instructions

### 5.1 Prerequisites

- Node.js 18+, npm 10+
- MongoDB 6+ (local) **or** an Atlas cluster
- A Clerk application (test instance is fine)
- A Cloudinary account

### 5.2 Run it

```bash
# 1. Backend
cd server
cp .env.example .env          # fill in MONGODB_URI, CLERK_*, CLOUDINARY_*, ADMIN_USER_IDS
npm install
npm run migrate               # first time only - backfills the legacy data
npm start                     # http://localhost:3000

# 2. Frontend (second terminal)
cd client
cp .env.example .env          # fill in VITE_CLERK_PUBLISHABLE_KEY and VITE_BACKEND_URL
npm install
npm run dev                   # http://localhost:5173
```

### 5.3 Verify the backend

```bash
cd server
npm test          # 33 integration tests
npm run check     # syntax check of every changed server file
```

The suite **connects to `quickstay-test` only** — `configs/db.js` now honours `MONGODB_DB_NAME`, the test file pins it to `quickstay-test`, and a guard aborts the run if the target host is not local:

```
REFUSING TO RUN THE TESTS AGAINST A REMOTE DATABASE.
  Target host : cluster0.example.mongodb.net
  Database    : quickstay-test
The test suite deletes all documents of the target database before it
starts. Set ALLOW_REMOTE_TEST_DB=1 to run against a remote throw-away
database on purpose.
```

> This was verified with a marker document: the marker survived the run, proving the suite no longer touches `hotel-booking` (the production database name).

### 5.4 Verify the frontend

```bash
cd client
npm run build    # production build
npm run lint     # 0 errors, 0 warnings
```

### 5.5 Test coverage (33 tests, all passing)

| Group | Covered |
| --- | --- |
| Roles & auth | 401 without a token; customer/owner/admin separation; `isAdmin`/`isOwner` middleware units. |
| Ownership | An owner cannot edit/delete another owner's hotel; a spoofed `owner` in the body is ignored. |
| Approval workflow | New hotel = `pending`; pending/rejected hidden from the public search; admin approve/reject; rejection reason persisted; owner edit flips an approved listing back to `pending`. |
| Public exposure | Legacy hotels without `approvalStatus` stay visible. |
| Rooms | Room ↔ hotel association, inventory counting, hotel-scoped list, room update/delete ownership. |
| Search | City, category, amenity, price range and date-availability filters; sorting; pagination. |
| Booking | Happy path; duplicate booking → 409; overlapping booking → 409; **8-way concurrent oversell → exactly one winner**; cancel releases inventory; unauthorized cancel rejected; invalid input rejected; booking an unapproved hotel blocked. |
| Compatibility | Legacy hotel/room documents without the new fields still work. |
| Coordinates | GeoJSON stored as `[longitude, latitude]` and mirrored with the scalars. |

### 5.6 Browser-level regression check

The React render loop that caused the flickering images cannot be caught by the
API test suite, so it was verified in a real (headless) Chrome over the Chrome
DevTools Protocol: the page is opened, every network request is recorded for a
fixed window, and the requests are counted per endpoint.

```bash
# 1. start the API and the frontend
cd server && npm start
cd client && npm run dev

# 2. count the calls the page makes
node cdp-check.mjs "http://localhost:5173/hotels" 9000 "/api/hotels"
```

| Page | Before the fix | After the fix |
| --- | --- | --- |
| `/hotels` | **96** `GET /api/hotels` in 9 s | **1** |
| `/hotels/:id` | 2 (one is the app-wide room list) | 2 |
| `/rooms` | 2 | 2 |
| `/owner/hotels`, `/admin/hotels`, `/my-bookings` | 1–2 | 1–2 |

The same check against the production build (`npm run build && npx vite preview`)
also reports **1** request. Every image asset is fetched exactly **once**
(the old loop re-downloaded the photos on every cycle).

---

## 6. API documentation

Base URL: `http://localhost:3000/api`
Protected endpoints require `Authorization: Bearer <Clerk JWT>`.

### 6.1 Error envelope

Every error uses the same shape:

```json
{ "success": false, "message": "Please correct the highlighted fields.",
  "details": { "city": "City is required" } }
```

| Status | Meaning |
| --- | --- |
| `400` | Validation / bad input (`details` carries the field map). |
| `401` | Missing or invalid token. |
| `403` | Authenticated but not allowed (wrong role or not the owner). |
| `404` | Not found — *also* returned for a pending listing seen by a stranger, so it cannot be probed. |
| `409` | Conflict — duplicate booking, overlapping dates, duplicate key. |
| `413` | Upload larger than 5 MB. |
| `429` | Rate limited (geocoding). |
| `500` | Unexpected — the real message is logged server side, never returned. |

### 6.2 Hotel endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/hotels` | public | Search (approved only). |
| `GET` | `/api/hotels/:id` | public / owner | Details + rooms + room types. |
| `GET` | `/api/hotels/my-hotels` | owner | Every hotel the caller manages. |
| `GET` | `/api/hotels/my-hotel` | owner | Legacy single-hotel endpoint (kept for the old dashboard). |
| `GET` | `/api/hotels/admin/all` | admin | All hotels + status counts. |
| `POST` | `/api/hotels` | owner | Create a listing (always `pending`). |
| `POST` | `/api/hotels/register` | owner | Legacy registration endpoint. |
| `PATCH` | `/api/hotels/:id` | owner/admin | Update a listing. |
| `DELETE` | `/api/hotels/:id` | owner/admin | Delete a listing (blocked with active bookings). |
| `PATCH` | `/api/hotels/:id/approve` | admin | Approve. |
| `PATCH` | `/api/hotels/:id/reject` | admin | Reject with a reason. |
| `POST` | `/api/hotels/:id/images` | owner/admin | Upload photos (`multipart/form-data`, field `images`). |
| `DELETE` | `/api/hotels/:id/images/:index` | owner/admin | Remove one photo. |
| `GET` | `/api/hotels/geocode?q=` | public (rate limited) | Address → coordinates. |
| `GET` | `/api/hotels/reverse-geocode?lat=&lon=` | public (rate limited) | Coordinates → address. |

**`GET /api/hotels` query parameters**

| Param | Example | Notes |
| --- | --- | --- |
| `city` | `Dubai` | Case-insensitive partial match on city, name or address. |
| `category` | `Resort,Hotel` | Comma-separated property types. |
| `amenities` | `Free WiFi,Pool Access` | Comma-separated; a hotel must have **all** of them. |
| `minPrice` / `maxPrice` | `100` / `500` | Per night, based on the hotel's rooms. |
| `checkIn` / `checkOut` | `2026-11-01` | Filters out hotels with no free room in that range. |
| `sort` | `price_asc` | `newest` (default), `price_asc`, `price_desc`, `rating`, `name_asc`, `name_desc`. |
| `page` / `limit` | `1` / `12` | `limit` is capped at 50. |

```bash
curl "http://localhost:3000/api/hotels?city=Dubai&category=Resort&amenities=Free%20WiFi&maxPrice=400&sort=price_asc&page=1"
```

```json
{
  "success": true,
  "hotels": [
    {
      "_id": "67f76393197ac559e4089b72",
      "name": "Urbanza Suites",
      "description": "A premium city hotel in the heart of New York...",
      "category": "Hotel",
      "address": "Main Road  123 Street , 23 Colony",
      "city": "New York",
      "state": "New York",
      "country": "United States",
      "postalCode": "10001",
      "latitude": 40.7128,
      "longitude": -74.006,
      "contact": "+0123456789",
      "contactEmail": "stay@urbanzasuites.com",
      "amenities": ["Free WiFi", "Free Breakfast", "Room Service", "Gym", "24/7 Front Desk"],
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "images": ["https://res.cloudinary.com/.../room1.jpg"],
      "rating": 4.5,
      "reviewCount": 0,
      "createdAt": "2026-10-22T03:58:38.674Z",
      "location": { "type": "Point", "coordinates": [-74.006, 40.7128] },
      "minPrice": 199,
      "maxPrice": 399,
      "roomCount": 4,
      "roomTypes": ["Double Bed", "Single Bed"],
      "availableForDates": true
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 1, "totalPages": 1, "hasNext": false },
  "filters": { "city": "Dubai", "categories": ["Resort"], "amenities": ["Free WiFi"],
               "minPrice": null, "maxPrice": 400, "checkIn": null, "checkOut": null }
}
```

> The public search deliberately omits `approvalStatus`, `owner` and `approvedAt` — moderation state is internal.

**`POST /api/hotels`** — body:

```json
{
  "name": "Harbour View Resort",
  "description": "Beachfront resort with three pools.",
  "category": "Resort",
  "address": "21 Beach Road",
  "city": "Sentosa",
  "state": "Singapore",
  "country": "Singapore",
  "postalCode": "099000",
  "latitude": 1.29027,
  "longitude": 103.851959,
  "contact": "+65 6123 4567",
  "contactEmail": "stay@harbourview.sg",
  "amenities": ["Free WiFi", "Pool Access", "Free Breakfast"],
  "checkInTime": "14:00",
  "checkOutTime": "11:00"
}
```

Response `201`:

```json
{
  "success": true,
  "message": "Hotel submitted for review. An admin has to approve the listing before it becomes visible to customers.",
  "hotel": { "...": "..." }
}
```

Validation errors return `400` with a per-field map:

```json
{ "success": false, "message": "Please correct the highlighted fields.",
  "details": { "city": "City is required", "latitude": "Latitude must be between -90 and 90" } }
```

**`PATCH /api/hotels/:id`** — same body, partial. On a material edit of an approved listing the hotel returns to `pending` and the message reads *"…pending review again after the update."*

**`PATCH /api/hotels/:id/reject`** — body `{ "reason": "Please add a photo of the entrance." }`; the reason is required (`400` otherwise) and is shown to the owner.

**`POST /api/hotels/:id/images`** — `multipart/form-data`, field name `images`, up to 10 files, 5 MB each, JPEG/PNG/WEBP/AVIF/GIF.

```json
{ "success": true, "message": "3 images uploaded successfully",
  "images": ["https://res.cloudinary.com/.../a.jpg", "..."],
  "imageIds": ["quickstay/hotels/abc/a", "..."] }
```

**`GET /api/hotels/:id`** — adds the room inventory:

```json
{
  "success": true,
  "hotel": { "...": "..." },
  "rooms": [ { "_id": "...", "roomType": "Double Bed", "pricePerNight": 249,
               "capacity": 2, "isAvailable": true, "isAvailableForDates": true } ],
  "roomTypes": [ { "roomType": "Double Bed", "total": 3, "available": 2, "pricePerNight": 249 } ],
  "availability": { "checkIn": "2026-11-01T00:00:00.000Z", "checkOut": "2026-11-03T00:00:00.000Z" },
  "viewer": { "isOwner": false, "isAdmin": false, "canManage": false }
}
```

**`GET /api/hotels/geocode?q=Main Road 123 Street`**

```json
{ "success": true,
  "results": [ { "displayName": "Main Road, 123 Street, New York, USA",
                 "latitude": 40.7128, "longitude": -74.006 } ] }
```

**`GET /api/hotels/reverse-geocode?lat=40.7128&lon=-74.006`**

```json
{ "success": true,
  "result": { "displayName": "Main Road, New York, USA",
              "latitude": 40.7128, "longitude": -74.006,
              "address": { "road": "Main Road", "city": "New York",
                           "state": "New York", "country": "United States" } } }
```

### 6.3 Room endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/rooms/list` | public | All rooms of approved hotels (legacy endpoint). |
| `GET` | `/api/rooms/my-rooms?hotelId=` | owner | The caller's rooms, optionally filtered by hotel. |
| `GET` | `/api/rooms/hotel/:hotelId` | public | Rooms of one hotel. |
| `GET` | `/api/rooms/hotel/:hotelId/types?checkIn=&checkOut=` | public | Inventory grouped by room type. |
| `GET` | `/api/rooms/availability/:roomId?checkIn=&checkOut=` | public | Availability of one room. |
| `GET` | `/api/rooms/:id` | public | Room details. |
| `POST` | `/api/rooms` | owner/admin | Create a room (`multipart/form-data`). |
| `PATCH` | `/api/rooms/:id` | owner/admin | Update a room. |
| `PATCH` | `/api/rooms/toggle/:roomId` | owner/admin | Toggle bookability. |
| `DELETE` | `/api/rooms/:id` | owner/admin | Delete a room (blocked with active bookings). |

**`POST /api/rooms`** — `multipart/form-data`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `hotelId` | text | ✅ | The hotel the room belongs to (owner or admin only). |
| `roomType` | text | ✅ | One of `Single Bed`, `Double Bed`, `Luxury Room`, `Family Room`, `Suite`, `Studio`, `Twin Bed`, `Deluxe Room`. |
| `pricePerNight` | number | ✅ | > 0. |
| `capacity` | number | | Guests, default `2`. |
| `description` | text | | Free text. |
| `amenities` | JSON string | | e.g. `["Free WiFi","Room Service"]`. |
| `images` | file[] | | Up to 6 images, 5 MB each. |

```json
{ "success": true, "message": "Room added successfully",
  "room": { "_id": "...", "roomType": "Double Bed", "pricePerNight": 249, "capacity": 2 },
  "hotel": { "_id": "...", "name": "Harbour View Resort" } }
```

### 6.4 Booking endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/bookings/create` | customer | Book a room (atomic). |
| `GET` | `/api/bookings/my-bookings` | customer | Own bookings. |
| `GET` | `/api/bookings/room/:roomId` | public | Availability of a room. |
| `GET` | `/api/bookings/dashboard` | owner/admin | Owner statistics. |
| `PATCH` | `/api/bookings/cancel/:bookingId` | customer | Cancel → releases the inventory slots. |
| `PATCH` | `/api/bookings/pay/:bookingId` | customer | Mark as paid. |
| `GET` | `/api/bookings/:bookingId` | customer | Booking details. |

**`POST /api/bookings/create`**

```json
{ "roomId": "67f7647c197ac559e4089b96",
  "checkInDate": "2026-11-01", "checkOutDate": "2026-11-03",
  "guests": 2, "paymentMethod": "Pay At Hotel" }
```

* Overlap with an existing booking → `409` *"This room was just booked for the selected dates. Please choose different dates."*
* Concurrent requests for the same night → exactly one succeeds, the rest get `409` (enforced by the unique `{room, date}` index on `BookingSlot`).
* Booking a room of a hotel that is not approved → `403`.
* On failure, any slots already written are rolled back.

---

## 7. Frontend routes

| Route | Access | Page |
| --- | --- | --- |
| `/hotels` | public | Hotel search — city, dates, price, property type, amenities, sorting, pagination. |
| `/hotels/:id` | public | Hotel details — gallery, amenities, map, directions, room selection, booking. |
| `/owner` | owner/admin | Owner dashboard (existing). |
| `/owner/my-hotels` | owner/admin | All listings + status + stats + actions. |
| `/owner/add-hotel` | any signed-in user | Create a listing (promotes a customer to `hotelOwner`). |
| `/owner/edit-hotel/:id` | owner/admin | Edit listing + manage photos. |
| `/owner/manage-rooms/:hotelId` | owner/admin | Room inventory, pricing, availability. |
| `/owner/add-room` | owner/admin | Add a room (hotel selector). |
| `/owner/list-room` | owner/admin | Room list with hotel column. |
| `/admin/hotels` | admin | Approval dashboard. |
| `/rooms`, `/rooms/:id`, `/my-bookings`, `/experience`, `/about`, `/` | public | Existing pages — unchanged behaviour. |

`ProtectedRoute` reads the role from the backend-synced profile. It is a **UX guard only** — the API re-checks every permission server side.

---

## 8. Per-role verification checklist

### Customer (`user`)

- [ ] Sign in → the navbar dashboard button opens the *register hotel* modal (not the owner panel).
- [ ] `/hotels` shows only **approved** listings; pending/rejected listings are absent.
- [ ] Filters work: city, price range, property type, amenities, dates; sorting and pagination work.
- [ ] `/hotels/:id` shows the gallery, amenities, check-in/out times and the map with a working *directions* link.
- [ ] Pick dates → room types show `N of M available`; a sold-out type is disabled.
- [ ] Booking a free room succeeds → the booking appears in `/my-bookings`.
- [ ] Booking the same room for overlapping dates fails with a clear conflict message.
- [ ] Booking a room of a **pending** hotel is rejected.
- [ ] `/owner` and `/admin/hotels` redirect/refuse access.

### Hotel owner (`hotelOwner`)

- [ ] `/owner/my-hotels` lists **all** of the owner's hotels with their status badge.
- [ ] *Add hotel* → the form validates name/address/city/contact; the listing is created **pending** and does not appear in the public search.
- [ ] The map: type an address → suggestions appear → click one → the marker moves; click the map → the marker jumps; drag the marker → the coordinates update and are shown.
- [ ] Save → the stored `latitude`/`longitude` and the GeoJSON `location` point match (GeoJSON is `[lng, lat]`).
- [ ] Upload photos → they appear in the gallery; delete one → it disappears (and the Cloudinary asset is removed).
- [ ] *Manage rooms* → add a room with a type, price, capacity and images; the inventory count goes up.
- [ ] Toggle a room's availability → the public details page reflects it.
- [ ] Edit a room's price → the search results show the new price.
- [ ] Edit the listing (name/description/address) → the status goes back to **pending** and it disappears from the public search until re-approved.
- [ ] Try to open `/owner/edit-hotel/<someone-else's id>` → **403 / refused**.
- [ ] Try to add a room to another owner's hotel → **403**.

### Admin (`admin`)

- [ ] `/admin/hotels` shows counts (pending / approved / rejected / unreviewed) and the status tabs.
- [ ] Approve a pending listing → it becomes visible in `/hotels` immediately.
- [ ] Reject with a reason → the owner sees the reason on `/owner/my-hotels`.
- [ ] Edit any hotel (including another owner's) → allowed.
- [ ] The search box filters by name/city/address.
- [ ] As `ADMIN_USER_IDS`, the account is promoted to `admin` after the next sign-in/sync.

### Engineer

- [ ] `cd server && npm test` → 33/33 pass, connecting to `quickstay-test` only.
- [ ] The remote-host guard aborts the suite when `MONGODB_URI_TEST` points to a remote host.
- [ ] `cd server && npm run migrate -- --dry-run` → reports without changing anything.
- [ ] `cd client && npm run build` → succeeds; `npm run lint` → 0 errors.
- [ ] `grep -r "CLOUDINARY_API_SECRET\|CLERK_WEBHOOK_SECRET\|mongodb+srv" client/src` → no hits.

---

## 9. Deploying

### Backend (Vercel serverless)

```bash
vercel --prod          # from the server/ directory
```

Set the environment variables from §3.1 in the Vercel project (**Production**, **Preview** and **Development**). The API is stateless and serverless-safe:

- Uploads stream from memory to Cloudinary — nothing is written to the (read-only) filesystem.
- The connection pool is reused across warm invocations via the global Mongoose connection.
- `CLIENT_URL` restricts CORS to the real frontend domain.

### Frontend (Vercel)

```bash
cd client && vercel --prod
```

Set `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_BACKEND_URL` (the backend's production URL) and optionally the map tile variables. `VITE_*` variables are baked into the bundle at build time — rebuild after changing them.

---

## 10. Known limitations / untested areas

Honest list of what could **not** be verified on this machine:

1. **MongoDB Atlas is unreachable from this environment.** `cluster0.rgrvkkc.mongodb.net:27017` did not respond, so all verification ran against a **local MongoDB 8.0**. The code is provider-agnostic (standard `mongoose.connect`), but the Atlas path itself is untested here.
2. **No end-to-end HTTP test with a real Clerk token.** Clerk JWTs cannot be forged, so the protected endpoints were exercised by calling the controllers and the authorisation middleware directly with a simulated `req.user` (33 tests). The HTTP layer for protected routes was verified only for the *rejection* path (401 without a token, 403 for the wrong owner) and with `optionalAuth`.
3. **Cloudinary uploads were not executed end-to-end** — the credentials in `server/.env` are placeholders. The upload path is unit-covered (validation, limits, rollback of partial failures) but a real upload against a live Cloudinary account is untested.
4. **Geocoding against the live Nominatim API was not exercised** (network egress to `nominatim.openstreetmap.org` is blocked here). The proxy's error handling and rate limiter are implemented and unit-covered; the live response shape was written against the documented Nominatim format.
5. **Vercel deployment was not performed** — the configuration is described in §9 but not executed. Run the two deployment checklists there before going live.
6. **The lint warnings are gone.** `npm run lint` in `client/` now reports **0 errors and 0 warnings** — the six pre-existing `react-hooks/exhaustive-deps` warnings were resolved by stabilising the context helpers (§1a) and listing them as dependencies.
7. **Search filtering is bounded, not a full aggregation pipeline.** Candidate hotels are capped at 2 000, then price/availability filtering, sorting and pagination run in JavaScript. This is deliberate (it keeps the room-availability join correct) but it will need revisiting at a much larger scale — a materialised `BookingSlot` index or a dedicated search index is the natural next step.
8. **Geocoding quality depends on OpenStreetMap data.** A vague address may return no match; the UI tells the owner to click the map instead, and coordinates are never invented.
9. **Only the primary listings language (English) is supported.** The rest of the original app is unchanged and still single-language.
10. **Payments are unchanged** — the existing `Pay At Hotel` / Stripe flow is untouched; no payment provider was added.
11. **The admin panel reuses the owner shell.** A dedicated admin design system was out of scope; the layout, sidebar and components are shared with the owner area.

---

## 11. Repository hygiene

- Nothing was committed — the work sits in the working tree, on top of the pre-existing uncommitted modifications that were already in the repository (these were **not** reverted).
- `server/.env` and `client/.env` remain git-ignored and were never printed into a tracked file.
- `server/tmp_dump.mjs` (a temporary inspection script) was deleted.
- The local development database was restored to its seeded state (`Urbanza Suites` + 4 rooms + the demo owner) after the test runs.
