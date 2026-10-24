import React, { useEffect, useMemo, useState } from "react";
import { assets } from "../../assets/assets";

// The API rejects anything that is not an image and anything above 5 MB,
// so the same rules are applied here to give instant feedback.
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Reusable photo picker.
 *
 * - `existingImages`  photos that are already stored on the server
 * - `value`            files that have been picked but not uploaded yet
 * - `onChange`         receives the new list of files
 * - `onRemoveExisting` called with the index of the photo to delete
 */
const ImageUploader = ({
  existingImages = [],
  value = [],
  onChange,
  onRemoveExisting,
  max = 8,
  label = "Photos",
  hint = "JPG, PNG, WEBP, AVIF or GIF - up to 5 MB each.",
}) => {
  const [error, setError] = useState("");

  // Object URLs have to be revoked, otherwise the browser keeps the blob in
  // memory for the whole session.
  const previews = useMemo(
    () => value.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [value]
  );

  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [previews]
  );

  const total = existingImages.length + value.length;
  const disabled = total >= max;

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const invalid = files.find(
      (file) => !ACCEPTED_TYPES.includes(file.type?.toLowerCase())
    );
    if (invalid) {
      setError(`"${invalid.name}" is not a supported image format.`);
      return;
    }

    const tooBig = files.find((file) => file.size > MAX_FILE_SIZE);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than 5 MB.`);
      return;
    }

    if (total + files.length > max) {
      setError(`You can upload at most ${max} photos.`);
      return;
    }

    setError("");
    onChange?.([...value, ...files]);
  };

  const removeFile = (index) => {
    const next = [...value];
    next.splice(index, 1);
    onChange?.(next);
  };

  return (
    <div>
      <p className="text-gray-800 font-medium">
        {label} <span className="text-xs font-normal text-gray-500">({total}/{max})</span>
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
        {existingImages.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className="relative w-full aspect-square rounded overflow-hidden border border-gray-300 group"
          >
            <img
              src={image}
              alt={`Hotel photo ${index + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                if (!e.target.dataset.fallbackApplied) {
                  e.target.dataset.fallbackApplied = "true";
                  e.target.src = assets.roomImg1;
                }
              }}
            />
            {onRemoveExisting ? (
              <button
                type="button"
                onClick={() => onRemoveExisting(index)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs leading-none cursor-pointer"
                title="Remove photo"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}

        {previews.map((preview, index) => (
          <div
            key={preview.url}
            className="relative w-full aspect-square rounded overflow-hidden border border-gray-300"
          >
            <img
              src={preview.url}
              alt={preview.file.name}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeFile(index)}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs leading-none cursor-pointer"
              title="Remove photo"
            >
              ×
            </button>
          </div>
        ))}

        {!disabled && (
          <label htmlFor="hotel-image-upload" className="cursor-pointer">
            <div className="w-full aspect-square border border-dashed border-gray-300 rounded flex items-center justify-center overflow-hidden hover:bg-gray-50">
              <img className="h-8 opacity-60" src={assets.uploadArea} alt="Upload" />
            </div>
            <input
              type="file"
              id="hotel-image-upload"
              accept="image/*"
              multiple
              hidden
              onChange={handleFiles}
            />
          </label>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">{hint}</p>
      {error ? <p className="text-sm text-red-600 mt-1">{error}</p> : null}
    </div>
  );
};

export default ImageUploader;
