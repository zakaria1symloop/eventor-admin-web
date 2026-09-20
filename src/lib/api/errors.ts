/** Standard error body returned by the API (backend/docs/api-standards.md §5). */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
  requestId?: string;
}

export interface ValidationDetail {
  field: string;
  code: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;
  readonly path: string | null;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string | null;
    path?: string | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? null;
    this.requestId = init.requestId ?? null;
    this.path = init.path ?? null;
  }

  /** Field errors for forms when `code === "VALIDATION_FAILED"`. */
  get fieldErrors(): ValidationDetail[] {
    return Array.isArray(this.details) ? (this.details as ValidationDetail[]) : [];
  }

  static isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiErrorBody).code === "string" &&
    typeof (value as ApiErrorBody).message === "string"
  );
}

/** Builds an ApiError from a failed Response, tolerating non-standard bodies. */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (isErrorBody(body)) {
    return new ApiError({
      status: body.statusCode ?? response.status,
      code: body.code,
      message: body.message,
      details: body.details,
      requestId: body.requestId ?? response.headers.get("x-request-id"),
      path: body.path,
    });
  }
  return new ApiError({
    status: response.status,
    code: response.status >= 500 ? "INTERNAL_ERROR" : "HTTP_ERROR",
    message: response.statusText || "Request failed",
    requestId: response.headers.get("x-request-id"),
  });
}
