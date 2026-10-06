/** An error with an HTTP status and a message that is safe to show to the person. */
export class HttpError extends Error {
  constructor(statusCode, message, errors, code) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code; // for the dashboard to act on, e.g. "mfa_required"
  }
}

/** 400 with every message by field and the first one up front. */
export function badRequest(errors) {
  return new HttpError(400, Object.values(errors)[0], errors);
}

export const notFound = message => new HttpError(404, message);
export const busy = () => new HttpError(503, 'GROWND is very busy right now. Please try again in a few seconds.');
