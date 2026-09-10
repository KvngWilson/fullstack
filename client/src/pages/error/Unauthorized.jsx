import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-16">
      <div className="flex flex-col items-center">
        <div className="mb-6 animate-fade-in">
          <svg
            className="w-16 h-16 text-warning"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 48 48"
          >
            <circle
              cx="24"
              cy="24"
              r="22"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M24 16v8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="24" cy="34" r="2" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-display md:text-heading font-strong text-warning mb-2 tracking-heading">
          Unauthorized
        </h1>
        <p className="space-sm-t text-lead text-muted-foreground max-w-md">
          You do not have permission to view this page.
        </p>
        <Link
          to="/"
          className="space-lg-t inline-flex items-center justify-center rounded-card text-body font-strong shadow bg-warning text-warning-foreground hover:bg-warning/90 focus:outline-none focus:ring-2 focus:ring-warning/30 focus:ring-offset-2 transition-all duration-150 px-6 py-3 gap-section animate-bounce-once"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to home
        </Link>
      </div>
    </div>
  );
}
