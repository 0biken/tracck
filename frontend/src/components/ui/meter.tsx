/** A thin progress bar. `tone="signal"` marks a finished or fully verified value. */
export function Meter({
  value,
  label,
  tone = "ink",
  className = "",
}: {
  /** 0 to 100 */
  value: number;
  label: string;
  tone?: "ink" | "signal";
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={`h-1 bg-line ${className}`}
    >
      <div className={`h-1 ${tone === "signal" ? "bg-signal" : "bg-ink"}`} style={{ width: `${value}%` }} />
    </div>
  );
}
