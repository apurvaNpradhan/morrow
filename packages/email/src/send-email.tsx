import { render } from "@react-email/components";
import type { ReactElement } from "react";
import type { OtpEmailProps } from "./templates/otp";
import OtpEmail from "./templates/otp";
import WorkspaceInvitationEmail, {
  type WorkspaceInvitationEmailProps,
} from "./templates/workspace-invitation";
import { deliver, describeError } from "./transport";

export type EmailResult = {
  success: boolean;
};

async function send(to: string, subject: string, element: ReactElement) {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  await deliver({ to, subject, html, text });
}

export const sendOtpEmail = async (
  to: string,
  subject: string,
  data: OtpEmailProps,
): Promise<EmailResult> => {
  try {
    await send(to, subject, OtpEmail(data));
    return { success: true };
  } catch (error) {
    console.error("Error sending OTP email", describeError(error));
    // Callers queue sign-in mail so responses reveal nothing about the
    // address; they still need the failure to report it.
    throw error;
  }
};

export const sendWorkspaceInvitationEmail = async (
  to: string,
  subject: string,
  data: WorkspaceInvitationEmailProps,
): Promise<EmailResult> => {
  try {
    await send(to, subject, WorkspaceInvitationEmail(data));
    return { success: true };
  } catch (error) {
    console.error(
      "Error sending workspace invitation email",
      describeError(error),
    );
    throw error;
  }
};
