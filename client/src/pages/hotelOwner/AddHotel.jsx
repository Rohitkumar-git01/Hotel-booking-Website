import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Title from "../../components/Title";
import HotelForm from "../../components/hotelOwner/HotelForm";
import { AppContext } from "../../context/AppContext";

/**
 * Create a new hotel listing.
 *
 * The listing is created in the "pending" state and only becomes visible to
 * customers after an admin approves it.
 */
const AddHotel = () => {
  const navigate = useNavigate();
  const { createHotel, uploadHotelImages, geocodeAddress, reverseGeocode } =
    useContext(AppContext);

  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const initialValues = useMemo(
    () => ({
      name: "",
      category: "",
      description: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      contact: "",
      contactEmail: "",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      latitude: "",
      longitude: "",
      amenities: [],
    }),
    []
  );

  const handleSubmit = async (values, { files: selectedFiles }) => {
    setBusy(true);
    setErrors({});
    setMessage(null);

    const result = await createHotel(values);

    if (!result.success) {
      setErrors(result.errors || {});
      setMessage({ type: "error", text: result.message });
      setBusy(false);
      return;
    }

    // The listing exists now, so the photos can be attached to it.
    if (selectedFiles?.length) {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("images", file));
      const upload = await uploadHotelImages(result.hotel._id, formData);
      if (!upload.success) {
        setMessage({
          type: "error",
          text: `The hotel was created, but the photos could not be uploaded: ${upload.message}`,
        });
        setBusy(false);
        return;
      }
    }

    setMessage({ type: "success", text: result.message });
    setBusy(false);
    navigate("/owner/my-hotels");
  };

  const handleSearchAddress = (query) => geocodeAddress(query);
  const handleReverseGeocode = (latitude, longitude) =>
    reverseGeocode(latitude, longitude);

  return (
    <div className="pb-16">
      <Title
        align="left"
        font="outfit"
        title="Add Hotel"
        subTitle="Create a listing for your property. Every new listing is reviewed by an admin before it becomes visible to guests."
      />

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
          onSearchAddress={handleSearchAddress}
          onReverseGeocode={handleReverseGeocode}
          images={files}
          onImagesChange={setFiles}
          errors={errors}
          busy={busy}
          submitLabel="Submit for review"
          cancelLabel="Cancel"
          onCancel={() => navigate("/owner/my-hotels")}
        />
      </div>
    </div>
  );
};

export default AddHotel;
