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
