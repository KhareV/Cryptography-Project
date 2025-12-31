/**
 * Global Error Handler Middleware
 * Centralized error handling for the application
 */

import { logger, ApiError } from '../utils/helpers.js';

/**
 * Not Found Handler
 * Handles 404 errors for undefined routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`);
  next(error);
};

/**
 * Global Error Handler
 * Handles all errors thrown in the application
 */
export const globalErrorHandler = (err, req, res, next) => {
  // Log the error
  logger. error('Error caught by global handler:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method:  req.method,
    body: req.body,
    query: req.query,
    userId: req.userId?. toString(),
  });

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err. errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err. name === 'CastError') {
    // Mongoose cast error (invalid ObjectId)
    statusCode = 400;
    message = `Invalid ${err.path}:  ${err.value}`;
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    message = `${field} already exists`;
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    statusCode = 401;
    message = 'Invalid token';
  } else if (err. name === 'TokenExpiredError') {
    // JWT expired
    statusCode = 401;
    message = 'Token expired';
  } else if (err.name === 'MulterError') {
    // File upload error
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds the limit';
    } else if (err. code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    } else {
      message = err.message;
    }
  } else if (err.type === 'entity. parse.failed') {
    // JSON parse error
    statusCode = 400;
    message = 'Invalid JSON in request body';
  }

  // Build error response
  const errorResponse = {
    success: false,
    error: message,
    ...(errors && { details: errors }),
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise. resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Socket error handler
 * Handles errors in socket event handlers
 */
export const handleSocketError = (socket, error, eventName = 'unknown') => {
  logger.error(`Socket error in event "${eventName}":`, {
    message:  error.message,
    stack: error. stack,
    socketId: socket.id,
    userId: socket.userId?.toString(),
  });

  socket.emit('error', {
    event: eventName,
    message: error. message || 'An error occurred',
    code: error.code || 'SOCKET_ERROR',
  });
};

export default {
  notFoundHandler,
  globalErrorHandler,
  asyncHandler,
  handleSocketError,
};