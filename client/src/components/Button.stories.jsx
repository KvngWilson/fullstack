import React from 'react';
import { Button } from './Button';

/**
 * Button Component Story
 * Showcases all variants, sizes, and states
 */
export default {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A flexible button component with multiple variants and sizes.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      description: 'Button visual variant',
      options: [
        'primary',
        'secondary',
        'success',
        'warning',
        'error',
        'ghost',
        'outline',
      ],
      control: { type: 'radio' },
    },
    size: {
      description: 'Button size',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      control: { type: 'radio' },
    },
    state: {
      description: 'Button state',
      options: ['default', 'loading', 'disabled'],
      control: { type: 'radio' },
    },
    disabled: {
      description: 'Disabled state',
      control: { type: 'boolean' },
    },
    loading: {
      description: 'Loading state with spinner',
      control: { type: 'boolean' },
    },
    children: {
      description: 'Button label text',
      control: { type: 'text' },
    },
    onClick: {
      action: 'clicked',
    },
  },
};

/**
 * Default button example
 */
export const Default = {
  args: {
    children: 'Click me',
    variant: 'primary',
    size: 'md',
  },
};

/**
 * All variants
 */
export const Variants = () => (
  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="success">Success</Button>
    <Button variant="warning">Warning</Button>
    <Button variant="error">Error</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="outline">Outline</Button>
  </div>
);

Variants.parameters = {
  docs: {
    description: {
      story: 'All available button variants for different use cases.',
    },
  },
};

/**
 * All sizes
 */
export const Sizes = () => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
    <Button size="xs">Extra Small</Button>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
    <Button size="xl">Extra Large</Button>
  </div>
);

Sizes.parameters = {
  docs: {
    description: {
      story: 'Button sizes from extra small to extra large.',
    },
  },
};

/**
 * Loading state
 */
export const Loading = {
  args: {
    children: 'Loading...',
    loading: true,
    variant: 'primary',
    size: 'md',
  },
};

Loading.parameters = {
  docs: {
    description: {
      story: 'Button with loading spinner and disabled interaction.',
    },
  },
};

/**
 * Disabled state
 */
export const Disabled = {
  args: {
    children: 'Disabled',
    disabled: true,
    variant: 'primary',
    size: 'md',
  },
};

Disabled.parameters = {
  docs: {
    description: {
      story: 'Disabled button with reduced opacity.',
    },
  },
};

/**
 * With icon example
 */
export const WithIcon = () => (
  <div style={{ display: 'flex', gap: '1rem' }}>
    <Button variant="primary" size="md">
      <span style={{ marginRight: '0.5rem' }}>➕</span>
      Create New
    </Button>
    <Button variant="error" size="md">
      <span style={{ marginRight: '0.5rem' }}>🗑️</span>
      Delete
    </Button>
  </div>
);

WithIcon.parameters = {
  docs: {
    description: {
      story: 'Button with icon and text content.',
    },
  },
};

/**
 * Accessibility features
 */
export const Accessibility = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <div>
      <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
        Focus state (press Tab):
      </p>
      <Button variant="primary">Tab to see focus ring</Button>
    </div>
    
    <div>
      <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
        Color contrast verification:
      </p>
      <Button variant="primary">Primary - WCAG AA</Button>
    </div>

    <div>
      <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
        Disabled state indication:
      </p>
      <Button variant="primary" disabled>Disabled button</Button>
    </div>
  </div>
);

Accessibility.parameters = {
  docs: {
    description: {
      story: 'Button accessibility features including focus states, color contrast, and disabled indication.',
    },
  },
};
