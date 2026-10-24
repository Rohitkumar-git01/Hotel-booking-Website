import React, { useContext } from 'react'
import HotelCard from './HotelCard'
import Title from './Title'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'

const FeatureDestination = () => {
    const navigate = useNavigate();
    const { rooms, roomsError, loading } = useContext(AppContext);

  return (
    <div className='flex flex-col items-center px-6 md:px-16 lg:px-24 bg-slate-50
    py-20'>

       <Title title={"Featured Destinations"} subTitle={"Explore some of the best hotels in the world"} align={"center"} />

        <div className='flex flex-wrap items-center justify-center gap-6 mt-20'>
            {loading ? (
                // Loading skeleton cards
                [...Array(4)].map((_, i) => (
                    <div key={i} className='max-w-70 w-full rounded-xl overflow-hidden bg-white shadow-2xl animate-pulse'>
                        <div className='w-full h-48 bg-gray-200' />
                        <div className='p-4 pt-5 space-y-3'>
                            <div className='h-4 bg-gray-200 rounded w-3/4' />
                            <div className='h-3 bg-gray-200 rounded w-1/2' />
                            <div className='h-8 bg-gray-200 rounded w-full mt-4' />
                        </div>
                    </div>
                ))
            ) : roomsError ? (
                <p className='text-red-500 text-sm mt-4'>Could not reach the server. Please try again shortly.</p>
            ) : rooms.length > 0 ? (
                rooms.slice(0,4).map((room, index) => (
                    <HotelCard key={room._id} room={room} index={index}/>
                ))
            ) : (
                <p className='text-gray-400 text-sm mt-4'>No rooms available at the moment. Check back soon!</p>
            )}
        </div>

        {rooms.length > 0 && (
            <button onClick={() => { navigate('/rooms'); scrollTo(0,0) }}
            className='my-16 px-4 py-2 text-sm font-medium border border-gray-300 rounded
            bg-white hover:bg-gray-50 transition-all cursor-pointer'>
                View All Destinations
            </button>
        )}
    </div>
  )
}

export default FeatureDestination