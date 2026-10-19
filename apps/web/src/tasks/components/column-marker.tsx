import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { cn } from "@/design-system/cn";
import { colorTextStyle } from "@/projects";

/*
 * The shapes are the Circle template's status icons (MIT, Copyright (c) 2025
 * lndev-ui): a dashed circle, an empty one, a pie, and a filled circle with a
 * check or a cross.
 */

const CHECK =
  "M7 0C3.13401 0 0 3.13401 0 7C0 10.866 3.13401 14 7 14C10.866 14 14 10.866 14 7C14 3.13401 10.866 0 7 0ZM11.101 5.10104C11.433 4.76909 11.433 4.23091 11.101 3.89896C10.7691 3.56701 10.2309 3.56701 9.89896 3.89896L5.5 8.29792L4.10104 6.89896C3.7691 6.56701 3.2309 6.56701 2.89896 6.89896C2.56701 7.2309 2.56701 7.7691 2.89896 8.10104L4.89896 10.101C5.2309 10.433 5.7691 10.433 6.10104 10.101L11.101 5.10104Z";
const CROSS =
  "M7 14C10.866 14 14 10.866 14 7C14 3.13401 10.866 0 7 0C3.13401 0 0 3.13401 0 7C0 10.866 3.13401 14 7 14ZM5.03033 3.96967C4.73744 3.67678 4.26256 3.67678 3.96967 3.96967C3.67678 4.26256 3.67678 4.73744 3.96967 5.03033L5.93934 7L3.96967 8.96967C3.67678 9.26256 3.67678 9.73744 3.96967 10.0303C4.26256 10.3232 4.73744 10.3232 5.03033 10.0303L7 8.06066L8.96967 10.0303C9.26256 10.3232 9.73744 10.3232 10.0303 10.0303C10.3232 9.73744 10.3232 9.26256 10.0303 8.96967L8.06066 7L10.0303 5.03033C10.3232 4.73744 10.3232 4.26256 10.0303 3.96967C9.73744 3.67678 9.26256 3.67678 8.96967 3.96967L7 5.93934L5.03033 3.96967Z";

/** The wedge of a pie icon, `fraction` of the way round from the top. */
function pie(fraction: number) {
  const angle = Math.min(fraction, 0.9999) * 2 * Math.PI;
  const x = 3.5 + 3.5 * Math.sin(angle);
  const y = 3.5 - 3.5 * Math.cos(angle);
  return `M 3.5,3.5 L3.5,0 A3.5,3.5 0 ${fraction > 0.5 ? 1 : 0},1 ${x.toFixed(4)},${y.toFixed(4)} z`;
}

/**
 * A Column's status icon in its colour: what a task in it is doing, by the
 * Column's category. `fraction` fills the pie of a `started` Column.
 */
export function ColumnMarker({
  column,
  fraction = 0.5,
  className,
}: {
  /** Without a colour the icon takes the text colour around it. */
  column: Pick<ProjectColumnRow, "category"> &
    Partial<Pick<ProjectColumnRow, "color">>;
  fraction?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 14 14"
      className={cn("size-4 shrink-0", className)}
      style={column.color ? colorTextStyle(column.color) : undefined}
    >
      {column.category === "done" ? (
        <path fill="currentColor" fillRule="evenodd" d={CHECK} />
      ) : column.category === "canceled" ? (
        <path fill="currentColor" fillRule="evenodd" d={CROSS} />
      ) : (
        <>
          <rect
            x="1"
            y="1"
            width="12"
            height="12"
            rx="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray={
              column.category === "backlog" ? "1.4 1.7" : undefined
            }
          />
          {column.category === "started" ? (
            <path
              fill="currentColor"
              transform="translate(3.5,3.5)"
              d={pie(fraction)}
            />
          ) : null}
        </>
      )}
    </svg>
  );
}
