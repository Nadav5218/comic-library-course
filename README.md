# Comic Library

Comic Library is a React + NestJS application for managing, reading and reviewing private PDF comics, books and lecture material.

## Main features

- Public catalog with permanent cover images while the original PDFs remain private.
- Secure PDF reading through short-lived Amazon S3 signed URLs.
- Reading progress, continue-reading, reset-progress and personal library support.
- Search and filters by title, author, series, year and reading status.
- Reader controls for zoom, fit-page, fit-width, fullscreen, page navigation and keyboard navigation.
- Reader submissions with an administrator review queue, administrator notes and approval/rejection reasons.
- In-app notifications when a submission is approved or rejected.
- Account-specific Gmail API notifications for administrators and request submitters.
- Drag-and-drop PDF uploads with upload progress and automatic page-one cover generation.
- Administrator dashboard, editing, deletion and cover repair for older PDFs.
- Whole-section add/remove controls for the personal library.
- Browser-tab isolated sessions so a reader account and an administrator account can remain signed in at the same time.

## Tech stack

- Frontend: React 18, React Router 7, TypeScript, Vite, TailwindCSS
- Backend: NestJS 11, Express, Mongoose
- Database: MongoDB
- Storage: private Amazon S3 bucket
- Authentication: JWT

## Running locally

Make sure MongoDB is running, copy `.env.example` to `.env`, fill in your settings and run:

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:8080` and proxies API requests to the NestJS server on port `3000`.

Production-style run:

```bash
npm run build
npm start
```

## Environment variables

| Variable                                              | Local default                             | Production                     |
| ----------------------------------------------------- | ----------------------------------------- | ------------------------------ |
| `MONGODB_URI`                                         | `mongodb://127.0.0.1:27017/comic_library` | Required with authentication   |
| `JWT_SECRET`                                          | Development fallback                      | Required, long and random      |
| `PORT`                                                | `3000`                                    | Optional                       |
| `APP_URL`                                             | `http://localhost:8080`                   | Required public origin         |
| `AWS_REGION`                                          | –                                         | Required                       |
| `AWS_S3_BUCKET`                                       | –                                         | Required                       |
| `AWS_ACCESS_KEY_ID`                                   | –                                         | Required for local credentials |
| `AWS_SECRET_ACCESS_KEY`                               | –                                         | Required for local credentials |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`             | –                                         | Recommended for notifications  |
| `GMAIL_REFRESH_TOKEN`                                 | –                                         | Recommended for notifications  |
| `GMAIL_SENDER_EMAIL`                                  | –                                         | Recommended for notifications  |
| `TEST_MAIL_TO`                                        | Falls back to the sender address          | Optional                       |

For hosted production environments, prefer an IAM role or another temporary-credential mechanism instead of long-lived AWS access keys when the hosting provider supports it.

Comic Library uses Gmail API as its only real e-mail provider. The backend uses the OAuth refresh token to obtain short-lived access tokens and sends messages with the `gmail.send` scope. The saved access token from OAuth Playground is not required. If Gmail API is not configured in development, messages are written to `logs/mail/` instead of being sent. Never commit OAuth client secrets, refresh tokens, or the real `.env` file to the repository.

`GMAIL_SENDER_EMAIL` is the system sending mailbox only. A new submission sends a separate e-mail to every administrator account whose role is `admin`, using that administrator's current e-mail address from MongoDB. The Review button opens the login page and, after a successful administrator login, continues to the exact request. Approval or rejection sends an automatic e-mail to the submitting user's current e-mail address from MongoDB, with the request's saved e-mail as a fallback. An optional administrator note is saved on the request and is included in the user's e-mail and submission history. In-app notifications continue to work independently. A mail delivery failure is logged and does not roll back an already saved request, approval, or rejection.

After adding the Gmail API values to `.env`, restart the server. The startup log should contain `Gmail API OAuth credentials verified successfully.` Run `TEST_MAIL_TO=recipient@example.com npm run mail:test` to send a real Gmail API test message. When the OAuth app remains in Google's Testing publishing state, Google may expire the refresh token according to its testing-token policy, so production deployment should use an appropriate long-lived OAuth configuration.

## Creating an administrator

Regular registration always creates a normal user. To bootstrap or reset an administrator, set these values temporarily in `.env`:

```text
ADMIN_USERNAME=
ADMIN_EMAIL=
ADMIN_PHONE=
ADMIN_PASSWORD=
```

Then run:

```bash
npm run admin:create
```

Remove the `ADMIN_*` values from `.env` after the administrator has been created.

## Security

- Passwords are hashed with bcrypt using a cost factor of 12.
- Production refuses to start without a `JWT_SECRET` of at least 48 characters.
- Production refuses to use a MongoDB URI without credentials.
- JWT sessions expire after 8 hours.
- Every protected request verifies that the user still exists and uses the role stored in MongoDB.
- Administrator routes are protected on both the frontend and backend.
- Login and registration have stricter rate limits, with a general API rate limit for abuse protection.
- CORS is restricted to the configured application origin and local development origins. Production also requires an HTTPS `APP_URL`.
- Security headers include content-type protection, frame protection, referrer policy, permissions policy and a production CSP.
- Uploaded PDFs are checked for a real PDF file signature in addition to MIME filtering.
- Uploads are staged outside the public web directory and streamed to S3.
- PDF files are not returned by the public catalog API. Authenticated readers receive short-lived signed URLs only when opening a comic.
- Catalog covers are stored separately from the private PDF so the catalog does not need access to the document itself.
- AWS credentials remain server-side and `.env` is excluded by `.gitignore`.

HTTPS is still required for any real production deployment.

## Final verification

After installing dependencies on the target machine, run:

```bash
npm run verify
npm audit
```

`npm run verify` type-checks the frontend and backend, builds the client and server, and runs the test suite. Review any `npm audit` findings before a public production deployment.

For S3, keep Block Public Access enabled. Configure bucket CORS only for the frontend origins that actually need to read signed objects, such as `http://localhost:8080` during development and the exact HTTPS production origin after deployment.
