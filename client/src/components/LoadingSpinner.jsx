import React from "react";

const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full py-20">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing ring */}
        <div className="w-16 h-16 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin"></div>
        {/* Inner static pulse dot */}
        <div className="absolute w-6 h-6 rounded-full bg-orange-500/30 animate-ping"></div>
      </div>
      <p className="mt-4 text-sm font-medium text-gray-500 tracking-wide">
        Loading QuickStay...
      </p>
    </div>
  );
};

export default LoadingSpinner;
