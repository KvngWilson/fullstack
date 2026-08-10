import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again in a moment.',
  retryLabel = 'Try again',
  onRetry,
  className = '',
}) {
  return (
    <div
      className={`rounded-section border border-red-100 bg-white/85 p-6 shadow-[0_22px_70px_-48px_rgba(239,68,68,0.35)] backdrop-blur-xl ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h3 className="font-heading text-lg font-semibold tracking-tight text-slate-950">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title = 'No results yet',
  message = 'Try adjusting your filters or search terms.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div
      className={`rounded-section border border-white/70 bg-white/82 p-8 text-center shadow-[0_24px_80px_-48px_rgba(15,23,42,0.24)] backdrop-blur-xl ${className}`}
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
