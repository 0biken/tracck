import type { ReactNode } from "react";

/** Placeholder block for page loads. Match the final layout so nothing jumps. */
export function Skeleton({ className = "h-3.5 w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-sunken ${className}`} />;
}

/** An empty screen explains what belongs here and offers the next step. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface px-5 py-8 text-center">
      <h2 className="font-display text-h3 font-semibold">{title}</h2>
      <p className="max-w-[44ch] text-ink-muted">{children}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
