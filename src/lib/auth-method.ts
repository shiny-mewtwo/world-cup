export const LAST_SIGN_IN_METHOD_COOKIE = "world-cup:last-sign-in-method";
export const OAUTH_RETURN_PATH_COOKIE = "world-cup:oauth-return-path";

export const SIGN_IN_METHODS = ["credentials", "google"] as const;
export const AUTH_ENTRY_PATHS = ["/login"] as const;

export type SignInMethod = (typeof SIGN_IN_METHODS)[number];
export type AuthEntryPath = (typeof AUTH_ENTRY_PATHS)[number];

export function parseSignInMethod(value: string | undefined) {
  if (value === "credentials" || value === "google") {
    return value;
  }

  return null;
}

export function getSignInMethodLabel(method: SignInMethod) {
  if (method === "google") {
    return "Google";
  }

  return "Email and password";
}

export function parseAuthEntryPath(value: string | undefined) {
  if (value === "/login") {
    return value;
  }

  return "/login";
}
