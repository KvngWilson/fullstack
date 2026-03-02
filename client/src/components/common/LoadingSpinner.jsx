const sizeClasses = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export default function LoadingSpinner({
  size = 'lg',
  text = 'Loading... ',
  fullscreen = true,
  className = '',
}) {
  const wrapperClasses = fullscreen
    ? 'flex min-h-screen items-center justify-center'
    : 'flex items-center justify-center';

  return (
    <div className={`${wrapperClasses} ${className}`} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div
          className={`animate-spin rounded-full border-muted border-b-primary ${sizeClasses[size] || sizeClasses.lg}`}
        />
        {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
      </div>
    </div>
  );
}
