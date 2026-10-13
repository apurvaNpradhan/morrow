import { Button } from "@react-email/components";
import React from "react";
import { colors, fontFamily } from "./tokens";

void React;

type EmailButtonProps = {
  href: string;
  fullWidth?: boolean;
  children: React.ReactNode;
};

export function EmailButton({
  href,
  fullWidth = false,
  children,
}: EmailButtonProps) {
  return (
    <Button
      href={href}
      className="m-btn"
      style={{ ...base, ...primary, ...(fullWidth ? block : null) }}
    >
      {children}
    </Button>
  );
}

const base = {
  display: "inline-block",
  padding: "9px 14px",
  borderRadius: "10px",
  fontFamily,
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: "500",
  textDecoration: "none",
};

const primary = {
  border: `1px solid ${colors.primary}`,
  backgroundColor: colors.primary,
  color: colors.primaryForeground,
};

const block = {
  display: "block",
  textAlign: "center" as const,
};
