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
  if (error instanceof ArenaDomainError) {
    return {
      status: statusByCode[error.code],
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } },
  };
}
