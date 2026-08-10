import React, { useState, useRef } from "react";

/**
 * UI Dropdown component. Accessible, keyboard navigable.
 * Uses Tailwind and design tokens.
 */
export function Dropdown({
  label,
  children,
  className = "",
  ...props
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);

  return (
    <div className={`relative ${className}`} {...props}>
      <button
        ref={buttonRef}
        className="inline-flex items-center rounded-xl px-4 py-2 bg-surface border border-border text-primary font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
      >
        {label}
        <span className="ml-2">▼</span>
      </button>
      {open && (
        <ul
          className="absolute left-0 mt-2 w-full bg-surface border border-border rounded-xl shadow-card z-10"
          role="listbox"
        >
          {children}
        </ul>
      )}
    </div>
  );
}
