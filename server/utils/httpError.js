// ---------------------------------------------------------------------------
// Small HTTP helpers shared by the controllers.
//
// Controllers throw `HttpError` and the centralised error middleware in
// `server/middleware/errorMiddleware.js` turns it into a consistent JSON
// response. That keeps status codes in one place instead of scattering
// `return res.status(...).json(...)` across every handler.
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = "Not authorized") => new HttpError(401, message);
export const forbidden = (message = "You are not authorized to perform this action") =>
  new HttpError(403, message);
export const notFound = (message = "Resource not found") => new HttpError(404, message);
export const conflict = (message, details) => new HttpError(409, message, details);

/**
 * Wraps an async express handler so rejected promises reach the error
 * middleware instead of hanging the request.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
