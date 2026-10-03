import { NextResponse } from "next/server";

export interface ApiError {
  error: string;
  code?: string;
}

/** Typed success response */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Typed error response — never expose internal errors to clients */
export function err(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) } satisfies ApiError, { status });
}

/** Rate limit exceeded */
export function tooManyRequests(message = "Too many requests. Please try again later.") {
  return err(message, 429, "RATE_LIMITED");
}

/** Unauthorized */
export function unauthorized(message = "Unauthorized") {
  return err(message, 401, "UNAUTHORIZED");
}

/** Forbidden */
export function forbidden(message = "Forbidden") {
  return err(message, 403, "FORBIDDEN");
}

/** Server error — log internally, return safe message to client */
export function serverError(message = "An unexpected error occurred. Please try again.") {
  return err(message, 500, "SERVER_ERROR");
}
