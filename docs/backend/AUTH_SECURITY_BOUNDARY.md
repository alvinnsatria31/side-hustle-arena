# Arena Auth Security Boundary

Browser sends a one-use code to Canonical Sekolah Karir Auth. The browser sends arena_session only to Arena Server, which stores a token hash in Arena DB. Arena Server authenticates to Canonical Sekolah Karir Auth over a fixed server-to-server backchannel.

- skw_session: canonical system only; host-only and unchanged.
- Authorization code: browser transit only; short-lived, one-use, hashed at rest.
- PKCE verifier: temporary Arena HttpOnly cookie and Arena server only.
- Client secret: Arena and canonical servers only.
- arena_session: Arena browser and Arena server only; host-only opaque credential.
- Session hash: Arena DB only.
- Canonical grant ID: Arena server/DB only; it is not a bearer credential.

No password, canonical cookie value, authorization code, verifier, client secret, or database URL is logged by this implementation.
