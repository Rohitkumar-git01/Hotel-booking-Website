import React from "react";
import { assets } from "../../assets/assets";

/**
 * Small confirmation dialog used before destructive actions
 * (deleting a listing, removing a photo, ...).
 */
const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  tone = "danger",
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-primary hover:bg-primary-dull";

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-medium text-gray-800">{title}</h2>
          <img
            src={assets.closeIcon}
            alt="close"
            className="h-4 w-4 cursor-pointer"
            onClick={() => !busy && onCancel?.()}
          />
        </div>

        {message ? <p className="text-sm text-gray-600 mt-3">{message}</p> : null}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => !busy && onCancel?.()}
            disabled={busy}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm rounded text-white ${confirmClass} disabled:opacity-60 cursor-pointer`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
