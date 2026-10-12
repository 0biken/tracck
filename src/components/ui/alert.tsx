import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "bg-accent-tint", icon: "text-accent-ink", Icon: Info },
  success: { box: "bg-success-tint", icon: "text-success", Icon: CircleCheck },
  warning: { box: "bg-warning-tint", icon: "text-warning", Icon: TriangleAlert },
  danger: { box: "bg-danger-tint", icon: "text-danger", Icon: CircleX },
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
}: {
  tone: Tone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const { box, icon, Icon } = tones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg px-3.5 py-3 ${box}`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${icon}`} strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <strong className="block font-semibold">{title}</strong>
        {children && <p className="mt-0.5 text-label">{children}</p>}
        {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
