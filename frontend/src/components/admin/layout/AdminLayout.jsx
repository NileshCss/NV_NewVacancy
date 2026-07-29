import React, { useState, useEffect } from 'react'
import AdminHeader from './AdminHeader'
import AdminSidebar from './AdminSidebar'
import MobileNavDrawer from './MobileNavDrawer'
import MobileNavBackdrop from './MobileNavBackdrop'

export default function AdminLayout({ currentSection, onSelectSection, sectionTitle, children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Auto-close mobile drawer when section/route changes
  useEffect(() => {
    setMobileNavOpen(false)
  }, [currentSection])

  // Prevent background body scrolling while mobile nav drawer is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileNavOpen])

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans flex flex-col">
      {/* Top Header */}
      <AdminHeader
        sectionTitle={sectionTitle}
        onToggleMobileSidebar={() => setMobileNavOpen((prev) => !prev)}
      />

      {/* Main Container */}
      <div className="flex-1 flex min-w-0">
        {/* Desktop Sticky Sidebar */}
        <AdminSidebar
          currentSection={currentSection}
          onSelectSection={onSelectSection}
        />

        {/* Mobile Off-Canvas Navigation Drawer & Dark Backdrop */}
        <MobileNavBackdrop
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />
        <MobileNavDrawer
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          currentSection={currentSection}
          onSelectSection={(sec) => {
            onSelectSection(sec)
            setMobileNavOpen(false)
          }}
        />

        {/* Main Content Workspace */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
