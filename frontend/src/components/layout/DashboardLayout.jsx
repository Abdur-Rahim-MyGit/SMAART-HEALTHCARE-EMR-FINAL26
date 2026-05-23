import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { SearchProvider } from '../../contexts/SearchContext'
import SearchResults from '../search/SearchResults'
import { Menu, X } from 'lucide-react'

const DashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SearchProvider>
      <div className="flex h-full bg-gray-50 dark:bg-gray-900 mobile-fullscreen">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 dark:bg-opacity-70 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-full sm:w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } sidebar-portrait sidebar-landscape sidebar-tablet-portrait sidebar-tablet-landscape sidebar-desktop ${!sidebarOpen ? 'lg:collapsed' : ''}`}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out mobile-viewport-fix relative ${
          sidebarOpen ? 'lg:ml-64 xl:ml-64 2xl:ml-64' : 'ml-0'
        }`}>
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className={`flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 scroll-area animate-fadeIn bg-white dark:bg-gray-950 main-content-portrait main-content-landscape main-content-tablet-portrait main-content-tablet-landscape main-content-desktop main-content-large-desktop mobile-scrollable ${!sidebarOpen ? 'collapsed' : ''}`}>
            {children}
          </main>
        </div>
        <SearchResults />
      </div>
    </SearchProvider>
  )
}

export default DashboardLayout