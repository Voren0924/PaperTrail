import { NextResponse } from "next/server";

import {
  ApplicationError,
  toApiErrorResponse,
  toInternalErrorResponse
} from "@/server/errors/application-error";

export function jsonResponse<T>(body: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(body, init);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApplicationError) {
    return NextResponse.json(toApiErrorResponse(error), { status: error.status });
  }

  console.error(error);
  return NextResponse.json(toInternalErrorResponse(), { status: 500 });
}

export async function withApiErrors<T extends NextResponse>(
  handler: () => Promise<T>
): Promise<T | NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}
