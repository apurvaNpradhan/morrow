import {
  parseUserAgent,
  type UserAgentDevice,
} from "#api/auth/lib/parse-user-agent";

export type EmailRequestContext = {
  requestedAt: Date;
  device?: UserAgentDevice;
};

/** What a sign-in email says about the request: when it came and from which browser. Times are UTC. */
export function getEmailRequestContext(
  headers: Headers | null | undefined,
): EmailRequestContext {
  return {
    requestedAt: new Date(),
    device: parseUserAgent(headers?.get("user-agent")),
  };
}
