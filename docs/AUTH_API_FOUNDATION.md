# Auth And API Foundation Notes

Thread C adds the first browser auth API shape:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

Browser sessions use the `Session` table and an HTTP-only `papertrail_session` cookie. The raw browser token is never stored in the database; only its SHA-256 hash is persisted. Logout revokes the server-side session record and clears the cookie.

The current cookie uses `SameSite=Lax`, `HttpOnly`, `Secure` in production, and a path of `/`. This reduces CSRF exposure for normal browser navigation, but this thread does not add a full double-submit or synchronizer CSRF token mechanism. Follow-up work should add explicit CSRF tokens for state-changing browser requests before production use.

Passwords are hashed through a server-side password hasher abstraction using Node's built-in `crypto.scrypt`. Argon2id remains preferred for production review; bcrypt is also acceptable if an explicit dependency is introduced later. This implementation avoids adding native hashing dependencies while the project dependency surface is still small.

Future services should use `requireCurrentUser` or `getCurrentUser` from `apps/web/src/server/auth/current-user.ts` and `ensureOwnedRecord` from `apps/web/src/server/auth/ownership.ts`. Feature modules should not create parallel auth helpers.
