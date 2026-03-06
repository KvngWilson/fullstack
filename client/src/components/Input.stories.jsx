import React, { useState } from 'react';
import { Input, Textarea, FormField } from './ui/Input';

export default {
  title: 'Components/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      options: ['default', 'error', 'success'],
      control: { type: 'radio' },
    },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    type: {
      options: ['text', 'email', 'password', 'number'],
      control: { type: 'select' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    placeholder: {
      control: { type: 'text' },
    },
  },
};

export const Default = {
  args: {
    placeholder: 'Enter text...',
    variant: 'default',
    size: 'md',
  },
};

export const Variants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
    <Input variant="default" placeholder="Default" />
    <Input variant="error" placeholder="Error state" />
    <Input variant="success" placeholder="Success state" />
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
    <Input size="sm" placeholder="Small" />
    <Input size="md" placeholder="Medium" />
    <Input size="lg" placeholder="Large" />
  </div>
);

export const Types = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
    <Input type="text" placeholder="Text input" />
    <Input type="email" placeholder="Email input" />
    <Input type="password" placeholder="Password input" />
    <Input type="number" placeholder="Number input" />
  </div>
);

export const Disabled = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
    variant: 'default',
    size: 'md',
  },
};

export const WithLabel = () => (
  <FormField label="Email Address" required hint="Enter your email">
    <Input type="email" placeholder="you@example.com" />
  </FormField>
);

export const WithError = () => (
  <FormField label="Password" error="Password must be at least 8 characters">
    <Input type="password" variant="error" placeholder="Enter password" />
  </FormField>
);

export const TextareaStory = () => (
  <FormField label="Message" required>
    <Textarea placeholder="Enter your message..." rows={4} />
  </FormField>
);

TextareaStory.storyName = 'Textarea';

export const CompleteForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div style={{ width: '400px' }}>
      <FormField label="Name" required>
        <Input
          name="name"
          placeholder="John Doe"
          value={formData.name}
          onChange={handleChange}
        />
      </FormField>

      <FormField label="Email" required>
        <Input
          type="email"
          name="email"
          placeholder="john@example.com"
          value={formData.email}
          onChange={handleChange}
        />
      </FormField>

      <FormField label="Message" required>
        <Textarea
          name="message"
          placeholder="Your message..."
          rows={4}
          value={formData.message}
          onChange={handleChange}
        />
      </FormField>

      <pre style={{ marginTop: '1rem', fontSize: '0.75rem', background: '#f5f5f5', padding: '0.75rem', borderRadius: '0.5rem' }}>
        {JSON.stringify(formData, null, 2)}
      </pre>
    </div>
  );
};

export const Accessibility = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <FormField label="Password" required hint="Password must contain uppercase, lowercase, and number">
      <Input type="password" placeholder="Enter password" />
    </FormField>

    <FormField label="Confirm Password" error="Passwords do not match">
      <Input type="password" variant="error" placeholder="Confirm password" />
    </FormField>

    <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.5rem' }}>
      <p style={{ fontSize: '0.875rem', color: '#15803d' }}>
        ✓ All inputs have associated labels for screen readers<br/>
        ✓ Error messages use aria-live for announcements<br/>
        ✓ Required fields clearly marked with *<br/>
        ✓ Visual focus indicators enabled
      </p>
    </div>
  </div>
);
