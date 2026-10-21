import { cn } from "@/design-system/cn";

/** A small ring filled `done` of `total` of the way round, in the text colour. */
export function ProgressRing({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const radius = 5;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(done / total, 1) : 0;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 14 14"
      className={cn("size-3.5 shrink-0 -rotate-90", className)}
    >
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${fraction * circumference} ${circumference}`}
      />
    </svg>
  );
}
