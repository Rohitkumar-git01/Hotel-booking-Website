import React, { useContext, lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppContext } from './context/AppContext'
import LoadingSpinner from './components/LoadingSpinner'
import ProtectedRoute from './components/ProtectedRoute'

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
const AddHotel = lazy(() => import('./pages/hotelOwner/AddHotel'));
const EditHotel = lazy(() => import('./pages/hotelOwner/EditHotel'));
const MyHotels = lazy(() => import('./pages/hotelOwner/MyHotels'));
const ManageRooms = lazy(() => import('./pages/hotelOwner/ManageRooms'));
const HotelSearch = lazy(() => import('./pages/hotels/HotelSearch'));
const HotelDetails = lazy(() => import('./pages/hotels/HotelDetails'));
const AdminLayout = lazy(() => import('./pages/admin/Layout'));
const AdminHotels = lazy(() => import('./pages/admin/AdminHotels'));

const App = () => {
  const { showHotelReg } = useContext(AppContext);
  const pathname = useLocation().pathname;
  // The owner and admin panels bring their own navigation.
  const isDashboardPath = pathname.includes("owner") || pathname.includes("admin");

  return (
    <div>
      {!isDashboardPath && <Navbar />}

      <Suspense fallback={null}>
        {showHotelReg && <HotelReg />}
      </Suspense>

      <div className='min-h-[70vh]'>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/rooms' element={<AllRooms />} />
            <Route path='/rooms/:id' element={<RoomDetails />} />
            <Route path='/hotels' element={<HotelSearch />} />
            <Route path='/hotels/:id' element={<HotelDetails />} />
            <Route path='/my-bookings' element={<MyBookings />} />
            <Route path='/experience' element={<Experience />} />
            <Route path='/about' element={<About />} />

            {/* Hotel owner panel */}
            <Route path='/owner' element={
              <ProtectedRoute roles={["hotelOwner", "admin"]}>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="add-room" element={<AddRoom />} />
              <Route path="list-room" element={<ListRoom />} />
              <Route path="my-hotels" element={<MyHotels />} />
              <Route path="manage-rooms/:hotelId" element={<ManageRooms />} />
              {/* A customer can create their first listing here. */}
              <Route path="add-hotel" element={
                <ProtectedRoute roles={["*"]}>
                  <AddHotel />
                </ProtectedRoute>
              } />
              <Route path="edit-hotel/:id" element={<EditHotel />} />
            </Route>

            {/* Admin panel */}
            <Route path='/admin' element={
              <ProtectedRoute roles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminHotels />} />
              <Route path="hotels" element={<AdminHotels />} />
            </Route>
          </Routes>
        </Suspense>
      </div>

      {!isDashboardPath && <Footer />}

      <Suspense fallback={null}>
        <AIChatbot />
      </Suspense>
    </div>
  )
}

export default App
