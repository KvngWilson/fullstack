import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Global Error Boundary
 * 
 * Catches React component errors and prevents entire app from crashing
 * Displays a user-friendly error message with options to reload or go home
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isExpanded: false,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);

    this.setState({
      errorInfo,
    });

  }

  handleReload = () => {
    window.location.href = '/';
  };

  handleReloadPage = () => {
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({
      isExpanded: !prev.isExpanded,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-center text-gray-600 mb-6">
              We encountered an unexpected error. Please try again or contact support if the problem persists.
            </p>

            {/* Error Details */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6">
                <button
                  onClick={this.toggleDetails}
                  className="w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors flex items-center justify-between"
                >
                  <span>Error Details</span>
                  <span className="text-lg">{this.state.isExpanded ? '−' : '+'}</span>
                </button>
                {this.state.isExpanded && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded overflow-auto max-h-48">
                    <p className="text-xs text-red-700 font-mono whitespace-pre-wrap break-words">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <div className="mt-2 border-t border-red-200 pt-2">
                        <p className="text-xs text-red-600 font-mono whitespace-pre-wrap break-words">
                          {this.state.errorInfo.componentStack}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleReloadPage}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>
            </div>

            {/* Support Message */}
            <p className="text-center text-xs text-gray-500 mt-6">
              If the problem persists, please{' '}
              <a
                href="mailto:support@example.com"
                className="text-red-600 hover:text-red-700 font-medium"
              >
                contact support
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
