/**
 * Storybook Configuration
 * Component library and design system documentation
 */

module.exports = {
  stories: [
    '../src/**/*.stories.{js,jsx,ts,tsx}',
    '../src/components/**/*.stories.{js,jsx,ts,tsx}',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-viewport',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: true,
  },
  features: {
    storyStoreV7: true,
  },
  // Custom configuration
  previewHead: (head) => `
    ${head}
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
  `,
};
