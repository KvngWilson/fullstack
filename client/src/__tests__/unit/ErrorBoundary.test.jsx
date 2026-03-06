import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '@/components/common/ErrorBoundary';

/**
 * Component that throws an error
 */
function ThrowError() {
  throw new Error('Test error in component');
}

/**
 * Safe component
 */
function SafeComponent() {
  return <div>Safe content</div>;
}

describe('✅ Issue #3: Global Error Boundary', () => {
  // Suppress error logging for tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('should catch errors and display fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // ✅ Should display error UI instead of crashing
    expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    // ✅ Should render normal content when no error
    expect(screen.getByText('Safe content')).toBeInTheDocument();
    expect(screen.queryByText(/Oops!/)).not.toBeInTheDocument();
  });

  it('should provide retry button to reload page', async () => {
    const user = userEvent.setup();
    const originalLocation = window.location;
    delete window.location;
    window.location = { reload: vi.fn() };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const retryButton = screen.getByRole('button', { name: /Try Again/i });

    // ✅ Should have retry button
    expect(retryButton).toBeInTheDocument();

    // Click retry
    await user.click(retryButton);

    // ✅ Should call reload
    expect(window.location.reload).toHaveBeenCalled();

    window.location = originalLocation;
  });

  it('should provide go home button', async () => {
    const user = userEvent.setup();
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const homeButton = screen.getByRole('button', { name: /Go to Home/i });

    // ✅ Should have home button
    expect(homeButton).toBeInTheDocument();

    // Click home
    await user.click(homeButton);

    // ✅ Should navigate to home
    expect(window.location.href).toBe('/');

    window.location = originalLocation;
  });

  it('should show error details in development mode', () => {
    vi.stubEnv('DEV', true);

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // ✅ Should have error details toggle in dev
    const detailsButton = screen.getByText(/Error Details/i);
    expect(detailsButton).toBeInTheDocument();

    vi.unstubAllEnvs();
  });

  it('should log error for monitoring', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    consoleSpy.mockImplementation(() => {}); // Mock to avoid output

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // ✅ Should log error
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
