import {
  emailOTPClient,
  inferAdditionalFields,
  lastLoginMethodClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/app/lib/env";

const getBaseURL = () => {
  const apiUrl = env.apiOrigin;
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/");
  }
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  plugins: [
    lastLoginMethodClient(),
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        locale: {
          type: "string",
          required: false,
          input: true,
        },
        onboardingCompletedAt: {
          type: "date",
          required: false,
          input: false,
        },
      },
      session: {
        // The workspace last used; the API's `workspace.setActive` writes it.
        activeOrganizationId: {
          type: "string",
          required: false,
          input: false,
        },
      },
    }),
  ],
});
