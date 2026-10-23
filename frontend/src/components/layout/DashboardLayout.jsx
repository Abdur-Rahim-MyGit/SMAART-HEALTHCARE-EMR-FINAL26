import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { SearchProvider } from '../../contexts/SearchContext'
import SearchResults from '../search/SearchResults'

const DashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SearchProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </aside>

        {/* Main View Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 lg:p-6 scroll-area animate-fadeIn bg-gray-50/50 dark:bg-gray-900">
            {children}
          </main>
        </div>
        <SearchResults />
      </div>
    </SearchProvider>
  )
}

export default DashboardLayout