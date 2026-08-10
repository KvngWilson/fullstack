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

describe('Global Error Boundary', () => {
  // Suppress error logging for tests
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should catch errors and display fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Should display error UI instead of crashing
    expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    // Should render normal content when no error
    expect(screen.getByText('Safe content')).toBeInTheDocument();
    expect(screen.queryByText(/Oops!/)).not.toBeInTheDocument();
  });

  it('should provide retry button to reload page', async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const retryButton = screen.getByRole('button', { name: /Try Again/i });

    // Should have retry button
    expect(retryButton).toBeInTheDocument();

    // Click retry
    await user.click(retryButton);
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

    // Should have home button
    expect(homeButton).toBeInTheDocument();

    // Click home
    await user.click(homeButton);

    // Should navigate to home
    expect(window.location.href).toBe('http://localhost/');

    window.location = originalLocation;
  });

  it('should show error details in development mode', () => {
    process.env.DEV = 'true';

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Should have error details toggle in dev
    const detailsButton = screen.getByText(/Error Details/i);
    expect(detailsButton).toBeInTheDocument();
  });

  it('should log error for monitoring', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Should log error
    expect(console.error).toHaveBeenCalled();
  });
});
