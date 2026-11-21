/**
 * Auth configuration and environment check helpers for Astor.
 */

export const SESSION_COOKIE_NAME = 'astor_session';
export const OAUTH_STATE_COOKIE_NAME = 'astor_oauth_state';

/**
 * Returns true if MongoDB connection string is configured.
 */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

/**
 * Returns true if both MongoDB and Google OAuth client credentials are configured.
 */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.MONGODB_URI &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
  );
}

/**
 * Returns the public app URL for redirects.
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Returns the MongoDB database name to connect to.
 */
export function getDbName(): string {
  return process.env.MONGODB_DB_NAME || 'astor';
}
