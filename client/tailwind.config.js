const sharedConfig = require("../tailwind.config.shared.js");
const designTokens = require("./src/styles/design-tokens.js");

/** @type {import('tailwindcss').Config} */
export default {
  ...sharedConfig,
  theme: {
    extend: {
      ...sharedConfig.theme?.extend,
      ...designTokens.theme,
      colors: designTokens.colors,
      typography: designTokens.typography,
      spacing: designTokens.spacing,
      borderRadius: designTokens.borderRadius,
      boxShadow: designTokens.shadows,
      transitionProperty: designTokens.transitions,
      screens: designTokens.breakpoints,
      zIndex: designTokens.zIndex,
    },
    spacing: {
      section: "1.5rem",
      lg: "2rem",
      sm: "0.5rem",
    },
    borderRadius: {
      section: "1.5rem",
      card: "0.75rem",
      avatar: "9999px",
    },
    fontSize: {
      caption: "0.75rem",
      "body-sm": "0.875rem",
      body: "1rem",
      lead: "1.125rem",
      title: "1.5rem",
      heading: "2rem",
      display: "2.5rem",
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
