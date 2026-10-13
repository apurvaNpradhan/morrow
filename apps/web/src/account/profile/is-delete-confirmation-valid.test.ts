import { expect, it } from "vite-plus/test";
import { isDeleteConfirmationValid } from "./is-delete-confirmation-valid";

it("accepts the email regardless of case and padding", () => {
  expect(
    isDeleteConfirmationValid("  Mina@Example.com ", "mina@example.com"),
  ).toBe(true);
});

it("rejects other text and a missing email", () => {
  expect(isDeleteConfirmationValid("mina", "mina@example.com")).toBe(false);
  expect(isDeleteConfirmationValid("", undefined)).toBe(false);
});
