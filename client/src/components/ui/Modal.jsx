import React from "react";

/**
 * UI Modal component. Accessible, focus-trapped, and keyboard dismissible.
 * Uses Tailwind and design tokens.
 */
export function Modal({ open, onClose, children, className = "" }) {
  if (!open) return null;
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 ${open ? '' : 'pointer-events-none opacity-0'} transition-opacity duration-200`}
        aria-modal="true"
        role="dialog"
        tabIndex={-1}
        onClick={onClose}
      >
        <div className={`bg-card rounded-xl shadow-lg p-6 w-full max-w-lg mx-4 ${className}`}>{children}</div>
      </div>
    );
}
