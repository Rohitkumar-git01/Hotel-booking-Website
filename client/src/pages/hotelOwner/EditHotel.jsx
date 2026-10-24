import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Title from "../../components/Title";
import HotelForm from "../../components/hotelOwner/HotelForm";
import { AppContext } from "../../context/AppContext";
import { getApprovalMeta } from "../../constants/hotels";

/**
 * Edit an existing listing.
 *
 * Only the owner of the hotel (or an admin) can open this page - the API
 * rejects every other attempt.
 */
const EditHotel = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchHotelById, updateHotel, uploadHotelImages, removeHotelImage, geocodeAddress, reverseGeocode } =
    useContext(AppContext);

  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchHotelById(id);
      setHotel(data.hotel);
    } catch (error) {
      setLoadError(error.message || "Failed to load the hotel");
    } finally {
      setLoading(false);
    }
  }, [id, fetchHotelById]);

  useEffect(() => {
    load();
  }, [load]);

  const initialValues = hotel
    ? {
        name: hotel.name || "",
        category: hotel.category || "",
        description: hotel.description || "",
        address: hotel.address || "",
        city: hotel.city || "",
        state: hotel.state || "",
        country: hotel.country || "",
        postalCode: hotel.postalCode || "",
        contact: hotel.contact || "",
        contactEmail: hotel.contactEmail || "",
        checkInTime: hotel.checkInTime || "14:00",
        checkOutTime: hotel.checkOutTime || "11:00",
        latitude:
          typeof hotel.latitude === "number" ? String(hotel.latitude) : "",
        longitude:
          typeof hotel.longitude === "number" ? String(hotel.longitude) : "",
        amenities: Array.isArray(hotel.amenities) ? hotel.amenities : [],
      }
    : undefined;

  const handleSubmit = async (values, { files: selectedFiles }) => {
    setBusy(true);
    setErrors({});
    setMessage(null);

    const result = await updateHotel(id, values);

    if (!result.success) {
      setErrors(result.errors || {});
      setMessage({ type: "error", text: result.message });
      setBusy(false);
      return;
    }

    if (selectedFiles?.length) {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("images", file));
      const upload = await uploadHotelImages(id, formData);
      if (!upload.success) {
        setMessage({
          type: "error",
          text: `The listing was saved, but the photos could not be uploaded: ${upload.message}`,
        });
        setBusy(false);
        return;
      }
    }

    setMessage({ type: "success", text: result.message });
    setBusy(false);
    await load();
  };

  const handleRemoveImage = async (index) => {
    const result = await removeHotelImage(id, index);
    if (result.success) {
      setHotel((previous) => ({
        ...previous,
        images: result.images || [],
      }));
    } else {
      setMessage({ type: "error", text: result.message });
    }
  };

  const status = hotel ? getApprovalMeta(hotel.approvalStatus) : null;

  if (loading) {
    return <div className="py-20 text-center text-lg text-gray-500">Loading hotel...</div>;
  }

  if (loadError) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-red-500">{loadError}</p>
        <button
          onClick={load}
          className="mt-4 px-5 py-2 rounded bg-primary text-white text-sm hover:bg-primary-dull transition-all cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <Title
        align="left"
        font="outfit"
        title="Edit Hotel"
        subTitle="Update the listing details. Important changes send the hotel back for admin review."
      />

      {status ? (
        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100">
          <span className={`px-2 py-0.5 rounded-full ${status.badge}`}>
            {status.label}
          </span>
          <span className="text-gray-600">{status.description}</span>
        </div>
      ) : null}

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

      <div className="mt-8">
        <HotelForm
          initialValues={initialValues}
          onSubmit={handleSubmit}
          onSearchAddress={(query) => geocodeAddress(query)}
          onReverseGeocode={(latitude, longitude) =>
            reverseGeocode(latitude, longitude)
          }
          existingImages={hotel?.images || []}
          images={files}
          onImagesChange={setFiles}
          onRemoveImage={handleRemoveImage}
          errors={errors}
          busy={busy}
          submitLabel="Save changes"
          cancelLabel="Back to my hotels"
          onCancel={() => navigate("/owner/my-hotels")}
        />
      </div>
    </div>
  );
};

export default EditHotel;
