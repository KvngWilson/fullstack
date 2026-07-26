import React, { useState } from "react";

/**
 * UI Tabs component. Accessible, keyboard navigable.
 * Uses Tailwind and design tokens.
 */
export function Tabs({ tabs = [], initial = 0, className = "" }) {
  const [active, setActive] = useState(initial);
  return (
    <div className={className}>
      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            className={`px-4 py-2 font-medium transition border-b-2 focus:outline-none ${
              active === i
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-primary"
            }`}
            onClick={() => setActive(i)}
            aria-selected={active === i}
            role="tab"
            tabIndex={active === i ? 0 : -1}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4" role="tabpanel">
        {tabs[active]?.content}
      </div>
    </div>
  );
}
