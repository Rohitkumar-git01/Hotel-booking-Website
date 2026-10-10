import React, { useContext, lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppContext } from './context/AppContext'
import LoadingSpinner from './components/LoadingSpinner'

// Route-level Lazy Loading Code Splitting
const Home = lazy(() => import('./pages/Home'));
const AllRooms = lazy(() => import('./pages/AllRooms'));
const RoomDetails = lazy(() => import('./pages/RoomDetails'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const Experience = lazy(() => import('./pages/Experience'));
const About = lazy(() => import('./pages/About'));
const HotelReg = lazy(() => import('./components/HotelReg'));
const AIChatbot = lazy(() => import('./components/AIChatbot'));
const Layout = lazy(() => import('./pages/hotelOwner/Layout'));
const Dashboard = lazy(() => import('./pages/hotelOwner/Dashboard'));
const AddRoom = lazy(() => import('./pages/hotelOwner/AddRoom'));
const ListRoom = lazy(() => import('./pages/hotelOwner/ListRoom'));

const App = () => {
  const { showHotelReg } = useContext(AppContext);
  const isOwnerPath = useLocation().pathname.includes("owner");

  return (
    <div>
      {!isOwnerPath && <Navbar />}

      <Suspense fallback={null}>
        {showHotelReg && <HotelReg />}
      </Suspense>

      <div className='min-h-[70vh]'>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/rooms' element={<AllRooms />} />
            <Route path='/rooms/:id' element={<RoomDetails />} />
            <Route path='/my-bookings' element={<MyBookings />} />
            <Route path='/experience' element={<Experience />} />
            <Route path='/about' element={<About />} />
            <Route path='/owner' element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="add-room" element={<AddRoom />} />
              <Route path="list-room" element={<ListRoom />} />
            </Route>
          </Routes>
        </Suspense>
      </div>

      {!isOwnerPath && <Footer />}

      <Suspense fallback={null}>
        <AIChatbot />
      </Suspense>
    </div>
  )
}

export default App