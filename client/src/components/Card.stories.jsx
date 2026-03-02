import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Alert } from './Card';
import { Button } from './Button';

export default {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Default = () => (
  <Card style={{ width: '400px' }}>
    <CardHeader>
      <CardTitle>Card Title</CardTitle>
      <CardDescription>Card description or subtitle</CardDescription>
    </CardHeader>
    <CardContent>
      <p>Card content goes here. This is a simple card component.</p>
    </CardContent>
  </Card>
);

export const WithFooter = () => (
  <Card style={{ width: '400px' }}>
    <CardHeader>
      <CardTitle>Confirm Action</CardTitle>
    </CardHeader>
    <CardContent>
      <p>Are you sure you want to delete this item? This action cannot be undone.</p>
    </CardContent>
    <CardFooter>
      <Button variant="ghost" size="sm">Cancel</Button>
      <Button variant="error" size="sm">Delete</Button>
    </CardFooter>
  </Card>
);

export const Variants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <Card variant="default" style={{ width: '350px' }}>
      <CardHeader>
        <CardTitle>Default Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Standard card with border and subtle shadow.</p>
      </CardContent>
    </Card>

    <Card variant="elevated" style={{ width: '350px' }}>
      <CardHeader>
        <CardTitle>Elevated Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Prominent card with stronger shadow.</p>
      </CardContent>
    </Card>

    <Card variant="outline" style={{ width: '350px' }}>
      <CardHeader>
        <CardTitle>Outline Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Card with bold outline style.</p>
      </CardContent>
    </Card>

    <Card variant="ghost" style={{ width: '350px' }}>
      <CardHeader>
        <CardTitle>Ghost Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Transparent card, no background.</p>
      </CardContent>
    </Card>
  </div>
);

export const BadgeVariants = () => (
  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
    <Badge variant="primary">Primary</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="success">Success</Badge>
    <Badge variant="warning">Warning</Badge>
    <Badge variant="error">Error</Badge>
    <Badge variant="outline">Outline</Badge>
  </div>
);

export const AlertVariants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '400px' }}>
    <Alert variant="info" title="Information">
      This is an informational alert message.
    </Alert>
    <Alert variant="success" title="Success">
      The operation completed successfully.
    </Alert>
    <Alert variant="warning" title="Warning">
      Please review this important warning message.
    </Alert>
    <Alert variant="error" title="Error">
      An error occurred while processing your request.
    </Alert>
  </div>
);

export const ProductCard = () => (
  <Card variant="elevated" style={{ width: '300px' }}>
    <div style={{ height: '200px', background: '#e0e7ff', borderRadius: '0.5rem 0.5rem 0 0' }} />
    <CardHeader>
      <CardTitle>Wireless Headphones</CardTitle>
      <CardDescription>Premium audio quality</CardDescription>
    </CardHeader>
    <CardContent>
      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0284c7' }}>$199.99</p>
      <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
        High-quality sound with active noise cancellation
      </p>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <Badge variant="success">In Stock</Badge>
        <Badge variant="primary">New</Badge>
      </div>
    </CardContent>
    <CardFooter>
      <Button variant="primary" size="sm" style={{ flex: 1 }}>Add to Cart</Button>
    </CardFooter>
  </Card>
);

export const UserProfile = () => (
  <Card style={{ width: '300px' }}>
    <CardHeader>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#3b82f6',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '2rem',
          }}
        >
          JD
        </div>
        <CardTitle>John Doe</CardTitle>
        <CardDescription>john@example.com</CardDescription>
      </div>
    </CardHeader>
    <CardContent>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'center' }}>
        <div>
          <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>24</p>
          <p style={{ fontSize: '0.75rem', color: '#666' }}>Posts</p>
        </div>
        <div>
          <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>1.2k</p>
          <p style={{ fontSize: '0.75rem', color: '#666' }}>Followers</p>
        </div>
      </div>
    </CardContent>
    <CardFooter>
      <Button variant="outline" size="sm" style={{ flex: 1 }}>Follow</Button>
    </CardFooter>
  </Card>
);

export const Padding = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <Card padding="sm" variant="outline">
      <CardTitle>Small Padding</CardTitle>
    </Card>
    <Card padding="md" variant="outline">
      <CardTitle>Medium Padding</CardTitle>
    </Card>
    <Card padding="lg" variant="outline">
      <CardTitle>Large Padding</CardTitle>
    </Card>
    <Card padding="xl" variant="outline">
      <CardTitle>Extra Large Padding</CardTitle>
    </Card>
  </div>
);
