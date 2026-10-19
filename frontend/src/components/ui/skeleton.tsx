import type { ReactNode } from "react";

/** Placeholder block for page loads. Match the final layout so nothing jumps. */
export function Skeleton({ className = "h-3.5 w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-sunken-2 ${className}`} />;
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
    <div className="flex flex-col items-center gap-2 border border-line px-5 py-10 text-center">
      <h2 className="t-claim">{title}</h2>
      <p className="t-body-sm max-w-[44ch] text-ink-muted">{children}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
