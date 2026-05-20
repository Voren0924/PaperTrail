import type { ApiErrorShape, ApiResult } from "./types";

const DEFAULT_ERROR = "The request could not be completed.";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(input: { code: string; message: string; status: number; details?: Record<string, unknown> }) {
    super(input.message);
    this.name = "ApiClientError";
    this.code = input.code;
    this.status = input.status;
    this.details = input.details ?? {};
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: isFormDataBody(init.body)
      ? init.headers
      : {
          "Content-Type": "application/json",
          ...init.headers
        },
    ...init
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    const error = parseApiError(payload, response.status);
    throw new ApiClientError(error);
  }

  return payload as T;
}

export async function toApiResult<T>(request: Promise<T>): Promise<ApiResult<T>> {
  try {
    return { data: await request, error: null };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }

    return {
      data: null,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : DEFAULT_ERROR,
        details: {}
      }
    };
  }
}

function parseApiError(payload: unknown, status: number): ConstructorParameters<typeof ApiClientError>[0] {
  if (isApiErrorShape(payload)) {
    return {
      code: payload.error.code,
      message: payload.error.message,
      details: payload.error.details,
      status
    };
  }

  return {
    code: "REQUEST_FAILED",
    message: DEFAULT_ERROR,
    details: {},
    status
  };
}

async function parseJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return {};
  }

  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function isApiErrorShape(value: unknown): value is ApiErrorShape {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorShape).error?.code === "string" &&
    typeof (value as ApiErrorShape).error?.message === "string"
  );
}

function isFormDataBody(body: BodyInit | null | undefined): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}
