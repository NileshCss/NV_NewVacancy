import React from 'react'

export default function MobileNavBackdrop({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-xs z-50 transition-opacity duration-300 animate-fade-in cursor-pointer"
      aria-hidden="true"
    />
  )
}
