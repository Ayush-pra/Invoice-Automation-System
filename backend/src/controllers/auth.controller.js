import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';
import Integration from '../models/Integration.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Creates a Google OAuth2 client instance.
 */
function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/**
 * Generates a JWT token for the given user.
 */
function generateToken(userId) {
  return jwt.sign({ userId: userId.toString() }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Sets JWT as HTTP-only cookie on the response.
 */
function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * GET /api/auth/google
 * Redirects user to Google OAuth consent screen.
 */
export const googleAuth = asyncHandler(async (req, res) => {
  const oauth2Client = getOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.google.scopes,
  });

  res.redirect(authUrl);
});

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback, creates/updates user and integration.
 */
export const googleCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    throw new AppError('Authorization code not provided', 400);
  }

  const oauth2Client = getOAuth2Client();

  // Exchange authorization code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user info from Google
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: googleUser } = await oauth2.userinfo.get();

  if (!googleUser.email) {
    throw new AppError('Failed to retrieve email from Google', 400);
  }

  // Create or update user
  let user = await User.findOne({ googleId: googleUser.id });

  if (!user) {
    user = await User.create({
      name: googleUser.name,
      email: googleUser.email,
      avatar: googleUser.picture,
      googleId: googleUser.id,
    });
  } else {
    // Update user info on each login
    user.name = googleUser.name;
    user.avatar = googleUser.picture;
    await user.save();
  }

  // Store Gmail integration (upsert)
  await Integration.findOneAndUpdate(
    { userId: user._id, providerName: 'gmail' },
    {
      userId: user._id,
      providerName: 'gmail',
      type: 'email',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      status: 'active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Generate JWT and set cookie
  const token = generateToken(user._id);
  setTokenCookie(res, token);

  // Redirect to frontend
  res.redirect(`${config.frontendUrl}/auth/callback`);
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user.
 */
export const getMe = asyncHandler(async (req, res) => {
  // Check if user has Gmail integration
  const integration = await Integration.findOne({
    userId: req.user._id,
    providerName: 'gmail',
  }).select('status providerName');

  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
      },
      integrations: {
        gmail: integration
          ? { connected: true, status: integration.status }
          : { connected: false },
      },
    },
  });
});

/**
 * POST /api/auth/logout
 * Clears the auth cookie.
 */
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
  });

  res.json({ success: true, message: 'Logged out successfully' });
});
