import { Heading, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "./email-button";
import { Section } from "./section";
import { colors, shadow } from "./tokens";

void React;

type InvitationCardProps = {
  workspaceName: string;
  description: string;
  cta: string;
  href: string;
};

export function InvitationCard({
  workspaceName,
  description,
  cta,
  href,
}: InvitationCardProps) {
  return (
    <Section className="m-card" style={card}>
      <Heading as="h2" className="m-text" style={name}>
        {workspaceName}
      </Heading>
      <Text className="m-muted" style={descriptionStyle}>
        {description}
      </Text>
      <EmailButton href={href} fullWidth>
        {cta}
      </EmailButton>
    </Section>
  );
}

const card = {
  borderRadius: "16px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.border,
  backgroundColor: colors.background,
  boxShadow: shadow,
  padding: "24px",
  textAlign: "center" as const,
};

const name = {
  margin: "0 0 8px",
  color: colors.foreground,
  fontSize: "18px",
  lineHeight: "28px",
  fontWeight: "600",
};

const descriptionStyle = {
  margin: "0 0 24px",
  color: colors.mutedForeground,
  fontSize: "14px",
  lineHeight: "20px",
};
