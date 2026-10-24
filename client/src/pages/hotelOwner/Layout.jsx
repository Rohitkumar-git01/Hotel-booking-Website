import React from 'react'
import Navbar from '../../components/hotelOwner/Navbar'
import Sidebar from '../../components/hotelOwner/Sidebar'
import { Outlet } from 'react-router-dom'

const Layout = () => {
  return (
    <div className='flex flex-col min-h-screen' style={{ minHeight: '100dvh' }}>
       <Navbar/>
       <div className='flex flex-1 overflow-hidden'>
        <Sidebar />
        <div className='flex-1 p-4 pt-10 md:px-10 overflow-y-auto'>
          <Outlet/>
        </div>
       </div>
    </div>
  )
}

export default Layout