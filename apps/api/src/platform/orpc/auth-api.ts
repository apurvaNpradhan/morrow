import type { auth } from "#api/auth/index";

/** Better Auth's server API, for typing procedure outputs. */
export type AuthApi = (typeof auth)["api"];

/** What a Better Auth endpoint resolves to. */
export type AuthResult<K extends keyof AuthApi> = Awaited<
  ReturnType<AuthApi[K]>
>;

/** Loaded on demand: auth configuration imports verticals that import oRPC. */
export async function authApi(): Promise<AuthApi> {
  return (await import("#api/auth/index")).auth.api;
}
