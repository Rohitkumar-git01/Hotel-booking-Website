import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Title from "../../components/Title";
import { AppContext } from "../../context/AppContext";
import { getApprovalMeta } from "../../constants/hotels";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "unreviewed", label: "Unreviewed" },
];

/**
 * Admin dashboard: every listing with its owner and approval state.
 */
const AdminHotels = () => {
  const { fetchAdminHotels, approveHotel, rejectHotel } = useContext(AppContext);

  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminHotels({
        status: status || undefined,
        search: search || undefined,
        page,
        limit: 20,
      });
      if (result?.success) {
        setData(result);
      } else {
        setError(result?.message || "Failed to load the listings");
      }
    } catch (loadError) {
      setError(loadError.message || "Failed to load the listings");
    } finally {
      setLoading(false);
    }
  }, [status, search, page, fetchAdminHotels]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (hotel) => {
    setBusyId(hotel._id);
    const result = await approveHotel(hotel._id);
    setBusyId(null);
    setMessage(
      result.success
        ? { type: "success", text: result.message }
        : { type: "error", text: result.message }
    );
    await load();
  };

  const handleReject = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setReasonError("Please tell the owner what has to be fixed.");
      return;
    }
    setBusyId(rejecting._id);
    const result = await rejectHotel(rejecting._id, reason.trim());
    setBusyId(null);

    if (result.success) {
      setRejecting(null);
      setReason("");
      setReasonError("");
      setMessage({ type: "success", text: result.message });
      await load();
    } else {
      setMessage({ type: "error", text: result.message });
    }
  };

  const counts = data?.counts;

  return (
    <div className="pb-16">
      <Title
        align="left"
        font="outfit"
        title="Approval Dashboard"
        subTitle="Review the listings that guests submitted. Only approved hotels appear in the public search."
      />

      {counts ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { label: "Pending", value: counts.pending, tone: "bg-amber-50 text-amber-700 border border-amber-200" },
            { label: "Approved", value: counts.approved, tone: "bg-green-50 text-green-700 border border-green-200" },
            { label: "Rejected", value: counts.rejected, tone: "bg-red-50 text-red-700 border border-red-200" },
            { label: "Unreviewed", value: counts.unreviewed, tone: "bg-gray-50 text-gray-700 border border-gray-200" },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl p-4 ${card.tone}`}>
              <p className="text-2xl font-medium">{card.value}</p>
              <p className="text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mt-8">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`px-4 py-2 text-sm rounded-full border transition-all cursor-pointer ${
                status === tab.value
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2 md:ml-auto"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, city or address"
            className="border border-gray-300 rounded px-3 py-2 w-full md:w-72 outline-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded bg-primary text-white hover:bg-primary-dull transition-all cursor-pointer"
          >
            Search
          </button>
        </form>
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
        <div className="py-20 text-center text-lg text-gray-500">Loading listings...</div>
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
      ) : !data?.hotels?.length ? (
        <div className="py-20 text-center text-gray-500">No listings match this filter.</div>
      ) : (
        <div className="border border-gray-300 rounded-lg mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-gray-800 font-medium text-left">Hotel</th>
                <th className="py-3 px-4 text-gray-800 font-medium text-left">Owner</th>
                <th className="py-3 px-4 text-gray-800 font-medium text-center">Rooms</th>
                <th className="py-3 px-4 text-gray-800 font-medium text-center">Status</th>
                <th className="py-3 px-4 text-gray-800 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.hotels.map((hotel) => {
                const meta = getApprovalMeta(hotel.approvalStatus);
                return (
                  <tr key={hotel._id} className="border-t border-gray-200">
                    <td className="py-3 px-4">
                      <Link
                        to={`/hotels/${hotel._id}`}
                        className="text-gray-800 font-medium hover:text-primary transition-colors"
                      >
                        {hotel.name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[hotel.city, hotel.category].filter(Boolean).join(" · ")}
                      </p>
                      {hotel.rejectionReason ? (
                        <p className="text-xs text-red-600 mt-1">
                          {hotel.rejectionReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {hotel.owner?.username || hotel.owner || "Unknown"}
                      <p className="text-xs text-gray-400">{hotel.owner?.email}</p>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700">
                      {hotel.roomCount ?? 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {hotel.approvalStatus !== "approved" ? (
                          <button
                            onClick={() => handleApprove(hotel)}
                            disabled={busyId === hotel._id}
                            className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition-all cursor-pointer disabled:opacity-60"
                          >
                            Approve
                          </button>
                        ) : null}
                        {hotel.approvalStatus !== "rejected" ? (
                          <button
                            onClick={() => {
                              setRejecting(hotel);
                              setReason("");
                              setReasonError("");
                            }}
                            disabled={busyId === hotel._id}
                            className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer disabled:opacity-60"
                          >
                            Reject
                          </button>
                        ) : null}
                        <Link
                          to={`/owner/edit-hotel/${hotel._id}`}
                          className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination?.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <button
            onClick={() =>
              setPage((current) => Math.min(data.pagination.totalPages, current + 1))
            }
            disabled={page >= data.pagination.totalPages}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Next
          </button>
        </div>
      ) : null}

      {/* Reject dialog */}
      {rejecting ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 px-4">
          <form
            onSubmit={handleReject}
            className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl"
          >
            <h2 className="text-lg font-medium text-gray-800">
              Reject "{rejecting.name}"
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              The owner sees this reason and can fix the listing.
            </p>

            <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 mt-4">
              Reason
            </label>
            <textarea
              id="reject-reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Please add the exact address and a photo of the entrance."
              className="border border-gray-300 rounded px-3 py-2 w-full mt-1 outline-indigo-500"
            />
            {reasonError ? (
              <p className="text-sm text-red-600 mt-1">{reasonError}</p>
            ) : null}

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === rejecting._id}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer"
              >
                Reject listing
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default AdminHotels;
