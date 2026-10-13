import { Container, Head, Html, Preview } from "@react-email/components";
import React from "react";
import { themeCss } from "./theme";
import { colors, fontFamily } from "./tokens";

void React;

type EmailShellProps = {
  title: string;
  preview: string;
  children: React.ReactNode;
};

export function EmailShell({ title, preview, children }: EmailShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta
          name="format-detection"
          content="telephone=no, date=no, address=no, email=no, url=no"
        />
        <style>{themeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <body id="body" className="m-bg" style={body}>
        <div
          role="article"
          aria-roledescription="email"
          aria-label={title}
          lang="en"
          dir="ltr"
          className="m-bg"
          style={page}
        >
          <Container style={container}>
            <p className="m-text" style={wordmark}>
              Morrow
            </p>
            {children}
          </Container>
        </div>
      </body>
    </Html>
  );
}

const page = {
  backgroundColor: colors.background,
};

const body = {
  margin: "0",
  padding: "0",
  backgroundColor: colors.background,
  color: colors.foreground,
  fontFamily,
};

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "48px 24px 56px",
};

const wordmark = {
  margin: "0 0 40px",
  color: colors.foreground,
  fontSize: "19px",
  lineHeight: "28px",
  fontWeight: "600",
  letterSpacing: "-0.4px",
};
