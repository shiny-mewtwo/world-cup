import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./auth-error-message";

describe("getAuthErrorMessage", () => {
  it("returns null when the auth provider does not supply a single error code", () => {
    expect(getAuthErrorMessage(undefined)).toBeNull();
    expect(getAuthErrorMessage("")).toBeNull();
    expect(getAuthErrorMessage(["AccessDenied"])).toBeNull();
  });

  it("maps known NextAuth and OAuth errors to user-facing copy", () => {
    expect(getAuthErrorMessage("AccessDenied")).toBe(
      "Google sign-in was denied. Please try again.",
    );
    expect(getAuthErrorMessage("OAuthAccountNotLinked")).toBe(
      "That email is already attached to another sign-in method. Use the original method first.",
    );
    expect(getAuthErrorMessage("CallbackRouteError")).toBe(
      "We could not complete the Google sign-in callback. Please try again.",
    );
    expect(getAuthErrorMessage("RegistrationClosed")).toBe(
      "Registration is closed. Existing players can still sign in.",
    );
    expect(getAuthErrorMessage("PasswordResetUnavailable")).toBe(
      "Password resets are no longer available for this archived pool.",
    );
  });

  it("passes through unknown error strings so callers can surface server messages", () => {
    expect(getAuthErrorMessage("A specific provider error")).toBe(
      "A specific provider error",
    );
  });
});
