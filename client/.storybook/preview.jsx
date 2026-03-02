import React from 'react';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';
import '../src/styles/globals.css';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  viewport: {
    viewports: {
      ...INITIAL_VIEWPORTS,
      mobile: {
        name: 'Mobile',
        styles: {
          width: '375px',
          height: '667px',
        },
        type: 'mobile',
      },
      tablet: {
        name: 'Tablet',
        styles: {
          width: '768px',
          height: '1024px',
        },
        type: 'tablet',
      },
    },
  },
  a11y: {
    config: {
      rules: [
        {
          id: 'color-contrast',
          enabled: true,
        },
      ],
    },
  },
};

export const decorators = [
  (Story) => (
    <div style={{ padding: '2rem' }}>
      <Story />
    </div>
  ),
];
