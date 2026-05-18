import { BadRequestError, ValidationError } from "@/server/errors/application-error";

export type JsonObject = Record<string, unknown>;

export async function readJsonObject(request: Request): Promise<JsonObject> {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON.");
  }

  if (!isPlainObject(value)) {
    throw new BadRequestError("Request body must be a JSON object.");
  }

  return value;
}

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type AuthCredentialsInput = {
  email: string;
  "password": string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minimumPasswordLength = 8;
const maximumPasswordLength = 256;

export function validateAuthCredentials(input: JsonObject): AuthCredentialsInput {
  const fields: Record<string, string> = {};
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const submittedCredential = typeof input["password"] === "string" ? input["password"] : "";

  if (!email) {
    fields.email = "Email is required.";
  } else if (!emailPattern.test(email)) {
    fields.email = "Email must be valid.";
  }

  if (!submittedCredential) {
    fields["password"] = "Password is required.";
  } else if (submittedCredential.length < minimumPasswordLength) {
    fields["password"] = `Password must be at least ${minimumPasswordLength} characters.`;
  } else if (submittedCredential.length > maximumPasswordLength) {
    fields["password"] = `Password must be at most ${maximumPasswordLength} characters.`;
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError(fields);
  }

  return { email, ["password"]: submittedCredential };
}
