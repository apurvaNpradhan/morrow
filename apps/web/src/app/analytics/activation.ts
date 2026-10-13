import { isTrackingEnabled, track } from "./track";

const SIGNUP_KEY = "morrow:tracked-signup:";

export function trackSignup(user: { id: string }) {
  if (!isTrackingEnabled()) return;
  try {
    if (localStorage.getItem(SIGNUP_KEY + user.id)) return;
    localStorage.setItem(SIGNUP_KEY + user.id, "1");
  } catch {
    return;
  }
  track("Signup");
}
