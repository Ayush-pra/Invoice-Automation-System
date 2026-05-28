import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';

/**
 * Authentication middleware.
 * Verifies JWT from HTTP-only cookie and attaches user to request.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await User.findById(decoded.userId).select('-__v');
    if (!user) {
      throw new AppError('User not found. Please log in again.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    if (error.isOperational) {
      return next(error);
    }
    next(new AppError('Invalid or expired token. Please log in again.', 401));
  }
};

export default authMiddleware;
