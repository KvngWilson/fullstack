import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold">Unauthorized</h1>
      <p className="mt-4 text-muted-foreground">You do not have permission to view this page.</p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
      >
        Back to home
      </Link>
    </div>
  );
}
