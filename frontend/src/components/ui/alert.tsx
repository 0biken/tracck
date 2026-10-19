import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { box: string; icon: string; title: string; Icon: typeof Info }> = {
  info: { box: "border-line-strong bg-sunken", icon: "text-ink-muted", title: "", Icon: Info },
  success: { box: "border-signal bg-signal-tint", icon: "text-signal", title: "text-signal", Icon: CircleCheck },
  warning: { box: "border-line-strong bg-sunken", icon: "text-ink", title: "", Icon: TriangleAlert },
  danger: { box: "border-danger bg-danger-tint", icon: "text-danger-ink", title: "text-danger-ink", Icon: CircleX },
};

/**
 * Inline alert: a title says what happened, one sentence says what it means,
 * and `actions` say what to do. Only failures that need attention use role="alert".
 */
export function Alert({
  tone,
  title,
  children,
  actions,
  className = "",
}: {
  tone: Tone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const { box, icon, title: titleColor, Icon } = tones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 border px-5 py-4 ${box} ${className}`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${icon}`} strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <strong className={`block font-bold ${titleColor}`}>{title}</strong>
        {children && <div className="t-body-sm mt-0.5">{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
