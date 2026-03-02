import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again in a moment.',
  retryLabel = 'Try again',
  onRetry,
  className = '',
}) {
  return (
    <div className={`rounded-lg border border-destructive/30 bg-destructive/5 p-6 ${className}`} role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
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
    <div className={`rounded-lg border border-border bg-card p-8 text-center ${className}`}>
      <Inbox className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
