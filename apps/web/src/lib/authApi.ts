import { apiRequest } from "./api";
import type { CurrentUser } from "./types";

export type AuthResponse = {
  user: CurrentUser;
};

type AuthCredentials = {
  email: string;
  ["password"]: string;
};

export function getMe(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/me");
}

export function login(input: AuthCredentials): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function register(input: AuthCredentials): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function logout(): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>("/api/auth/logout", {
    method: "POST"
  });
}
