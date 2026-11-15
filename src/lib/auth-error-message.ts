const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Google sign-in was denied. Please try again.",
  AccountNotLinked:
    "That email is already attached to another sign-in method. Use the original method first.",
  OAuthAccountNotLinked:
    "That email is already attached to another sign-in method. Use the original method first.",
  CallbackRouteError:
    "We could not complete the Google sign-in callback. Please try again.",
  OAuthCallbackError:
    "We could not complete the Google sign-in callback. Please try again.",
  OAuthCreateAccount:
    "We could not create your account from Google. Please try again.",
  OAuthSignin: "Google sign-in did not complete. Please try again.",
  Configuration:
    "Google sign-in is not configured correctly yet. Check the local OAuth settings and try again.",
  RegistrationClosed:
    "Registration is closed. Existing players can still sign in.",
  PasswordResetUnavailable:
    "Password resets are no longer available for this archived pool.",
  Default: "We could not sign you in. Please try again.",
};

export function getAuthErrorMessage(error: string | string[] | undefined) {
  if (typeof error !== "string" || error.length === 0) {
    return null;
  }

  return AUTH_ERROR_MESSAGES[error] ?? error;
}
