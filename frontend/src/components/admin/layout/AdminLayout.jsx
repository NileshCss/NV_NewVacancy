import React, { useState } from 'react'
import AdminHeader from './AdminHeader'
import AdminSidebar from './AdminSidebar'

export default function AdminLayout({ currentSection, onSelectSection, sectionTitle, children }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans flex flex-col">
      {/* Dedicated Admin Top Header */}
      <AdminHeader
        sectionTitle={sectionTitle}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Main Container */}
      <div className="flex-1 flex min-w-0">
        {/* Grouped Sidebar */}
        <AdminSidebar
          currentSection={currentSection}
          onSelectSection={onSelectSection}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Content Area */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
