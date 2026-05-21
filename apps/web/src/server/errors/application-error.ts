export type ErrorDetails = Record<string, unknown>;

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UPLOAD_TOO_LARGE"
  | "SETTINGS_REQUIRED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export type ApiErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    details: ErrorDetails;
  };
};

export class ApplicationError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetails;

  constructor(code: ErrorCode, message: string, status: number, details: ErrorDetails = {}) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends ApplicationError {
  constructor(fields: Record<string, string>, message = "Request validation failed.") {
    super("VALIDATION_ERROR", message, 422, { fields });
    this.name = "ValidationError";
  }
}

export class UnauthenticatedError extends ApplicationError {
  constructor(message = "Sign in is required.") {
    super("UNAUTHENTICATED", message, 401);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = "You do not have permission to access this resource.") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = "Resource not found.", details: ErrorDetails = {}) {
    super("NOT_FOUND", message, 404, details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApplicationError {
  constructor(message = "Resource conflict.", details: ErrorDetails = {}) {
    super("CONFLICT", message, 409, details);
    this.name = "ConflictError";
  }
}

export class UploadTooLargeError extends ApplicationError {
  constructor(maxUploadMb: number, message = "Upload exceeds the configured size limit.") {
    super("UPLOAD_TOO_LARGE", message, 413, { maxUploadMb });
    this.name = "UploadTooLargeError";
  }
}

export class SettingsRequiredError extends ApplicationError {
  constructor(message = "Provider settings are required before using this feature.", details: ErrorDetails = {}) {
    super("SETTINGS_REQUIRED", message, 409, details);
    this.name = "SettingsRequiredError";
  }
}

export class BadRequestError extends ApplicationError {
  constructor(message = "Request is malformed.", details: ErrorDetails = {}) {
    super("BAD_REQUEST", message, 400, details);
    this.name = "BadRequestError";
  }
}

export function toApiErrorResponse(error: ApplicationError): ApiErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  };
}

export function toInternalErrorResponse(): ApiErrorResponse {
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      details: {}
    }
  };
}
