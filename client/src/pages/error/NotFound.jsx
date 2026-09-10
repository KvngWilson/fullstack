import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-16">
      <div className="flex flex-col items-center">
        <div className="mb-6 animate-fade-in">
          <svg
            className="w-20 h-20 text-primary"
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
            <text
              x="24"
              y="32"
              textAnchor="middle"
              fontSize="24"
              fill="currentColor"
              fontFamily="inherit"
            >
              404
            </text>
          </svg>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-primary mb-2 tracking-tight">
          Page Not Found
        </h1>
        <p className="mt-2 text-lg text-muted-foreground max-w-md">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-md text-base font-semibold shadow bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 transition-all duration-150 px-6 py-3 gap-2 animate-bounce-once"
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
          Go back home
        </Link>
      </div>
    </div>
  );
}
