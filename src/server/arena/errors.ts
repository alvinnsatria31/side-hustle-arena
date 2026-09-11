export const arenaDomainErrorCodes = [
  "WEEK_NOT_FOUND",
  "WEEK_NOT_OPEN",
  "WEEK_CLOSED",
  "SELECTION_DEADLINE_PASSED",
  "PROJECT_NOT_FOUND",
  "PROJECT_NOT_PUBLISHED",
  "PROJECT_NOT_IN_ACTIVE_WEEK",
  "ALREADY_ENROLLED_THIS_WEEK",
  "ENROLLMENT_NOT_FOUND",
  "SUBMISSION_NOT_FOUND",
  "SUBMISSION_ITEM_NOT_FOUND",
  "SUBMISSION_DEADLINE_PASSED",
  "SUBMISSION_REQUIREMENTS_INCOMPLETE",
  "FILE_LIMIT_EXCEEDED",
  "LINK_LIMIT_EXCEEDED",
  "FILE_TYPE_NOT_ALLOWED",
  "FILE_TOO_LARGE",
  "UPLOAD_INTENT_NOT_FOUND",
  "UPLOAD_INTENT_EXPIRED",
  "UPLOAD_VALIDATION_FAILED",
  "REVIEW_ATTEMPT_LIMIT_REACHED",
  "REVIEW_JOB_NOT_FOUND",
  "REVIEW_JOB_UNAVAILABLE",
  "REVIEW_VALIDATION_FAILED",
  "REVIEW_PROVIDER_FAILED",
  "WEEK_NOT_READY",
  "WEEK_NOT_FINALIZED",
  "WEEK_ALREADY_FINALIZED",
  "FEATURE_CLOSED",
  "STORAGE_NOT_CONFIGURED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
] as const;

export type ArenaDomainErrorCode = (typeof arenaDomainErrorCodes)[number];

const statusByCode: Record<ArenaDomainErrorCode, number> = {
  WEEK_NOT_FOUND: 404,
  WEEK_NOT_OPEN: 409,
  WEEK_CLOSED: 409,
  SELECTION_DEADLINE_PASSED: 409,
  PROJECT_NOT_FOUND: 404,
  PROJECT_NOT_PUBLISHED: 404,
  PROJECT_NOT_IN_ACTIVE_WEEK: 409,
  ALREADY_ENROLLED_THIS_WEEK: 409,
  ENROLLMENT_NOT_FOUND: 404,
  SUBMISSION_NOT_FOUND: 404,
  SUBMISSION_ITEM_NOT_FOUND: 404,
  SUBMISSION_DEADLINE_PASSED: 409,
  SUBMISSION_REQUIREMENTS_INCOMPLETE: 409,
  FILE_LIMIT_EXCEEDED: 409,
  LINK_LIMIT_EXCEEDED: 409,
  FILE_TYPE_NOT_ALLOWED: 409,
  FILE_TOO_LARGE: 409,
  UPLOAD_INTENT_NOT_FOUND: 404,
  UPLOAD_INTENT_EXPIRED: 409,
  UPLOAD_VALIDATION_FAILED: 409,
  REVIEW_ATTEMPT_LIMIT_REACHED: 409,
  REVIEW_JOB_NOT_FOUND: 404,
  REVIEW_JOB_UNAVAILABLE: 409,
  REVIEW_VALIDATION_FAILED: 422,
  REVIEW_PROVIDER_FAILED: 502,
  WEEK_NOT_READY: 409,
  WEEK_NOT_FINALIZED: 409,
  WEEK_ALREADY_FINALIZED: 409,
  FEATURE_CLOSED: 503,
  STORAGE_NOT_CONFIGURED: 503,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
};

export class ArenaDomainError extends Error {
  public readonly code: ArenaDomainErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ArenaDomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ArenaDomainError";
    this.code = code;
    this.details = details;
  }
}

export function toArenaErrorResponse(error: unknown) {
  const isDomainError = error instanceof ArenaDomainError || (
    typeof error === "object" &&
    error !== null &&
    ("code" in error && typeof (error as { code: unknown }).code === "string" && (error as { code: string }).code in statusByCode)
  );

  if (isDomainError) {
    const domainError = error as ArenaDomainError;
    return {
      status: statusByCode[domainError.code],
      body: {
        error: {
          code: domainError.code,
          message: domainError.message,
          ...(domainError.details ? { details: domainError.details } : {}),
        },
      },
    };
  }

  // An error that is not a domain error is, by definition, one nobody
  // anticipated — a dead database, a malformed credential, a bug. The response
  // stays deliberately opaque so it leaks nothing to the caller, but it must
  // still be recorded: swallowing it silently leaves a 500 with no trace
  // anywhere, which on a self-hosted box means `docker logs` shows a healthy
  // server and no reason for the failure. Server-side only.
  console.error("[arena] unhandled error:", error);

  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } },
  };
}
