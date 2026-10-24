import React from 'react'
import { Link } from 'react-router-dom'
import { assets } from '../assets/assets'

// Cycle through the 4 local room images for variety
const fallbackImages = [
  assets.roomImg1,
  assets.roomImg2,
  assets.roomImg3,
  assets.roomImg4,
];

const HotelCard = ({ room, index }) => {
  // Use Cloudinary URL if available, otherwise fall back to a local asset image
  const imgSrc =
    room.images && room.images.length > 0 && room.images[0]
      ? room.images[0]
      : fallbackImages[index % fallbackImages.length];

  return (
    <Link
      to={'/rooms/' + room._id}
      onClick={() => scrollTo(0, 0)}
      key={room._id}
      className='relative max-w-70 w-full rounded-xl overflow-hidden bg-white text-gray-500/90 shadow-2xl'
    >
      <img
        src={imgSrc}
        alt={room.hotel?.name || 'Room'}
        loading="lazy"
        decoding="async"
        className="w-full h-48 object-cover"
        onError={(e) => {
          // If the remote URL breaks, fall back to a local asset. Guard against
          // re-entering onError forever (e.target.src is absolute, the fallback
          // is relative, so a naive comparison never matches).
          const fallback = fallbackImages[index % fallbackImages.length];
          if (!e.target.dataset.fallbackApplied && e.target.src !== new URL(fallback, window.location.href).href) {
            e.target.dataset.fallbackApplied = "true";
            e.target.src = fallback;
          }
        }}
      />

      {index % 2 === 0 && (
        <p className='px-3 py-1 absolute top-3 left-3 text-xs bg-white text-gray-800 font-medium rounded-full'>
          Best seller
        </p>
      )}

      <div className='p-4 pt-5'>
        <div className='flex items-center justify-between'>
          <p className='font-playfair text-xl font-medium text-gray-800'>
            {room.hotel?.name || 'Hotel'}
          </p>
          <div className='flex items-center gap-1'>
            <img src={assets.starIconFilled} alt="star-icon" /> 4.5
          </div>
        </div>
        <div className='flex items-center gap-1 text-sm'>
          <img src={assets.locationIcon} alt="location-icon" />
          <span>{room.hotel?.address || 'Address unavailable'}</span>
        </div>
        <div className='flex items-center justify-between mt-4'>
          <p><span className='text-xl text-gray-800'>${room.pricePerNight}</span>/night</p>
          <button className='px-4 py-2 text-sm font-medium border border-gray-300 rounded hover:bg-gray-50 transition-all cursor-pointer'>
            Book Now
          </button>
        </div>
      </div>
    </Link>
  )
}

export default HotelCard