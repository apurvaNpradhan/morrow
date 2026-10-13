export class SlugUnavailableError extends Error {
  reason: "taken" | "reserved" | "invalid";

  constructor(reason: "taken" | "reserved" | "invalid") {
    super(`Workspace slug is ${reason}`);
    this.name = "SlugUnavailableError";
    this.reason = reason;
  }
}
