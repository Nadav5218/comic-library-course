# Comic Library

Comic Library is a full-stack React + NestJS application for managing, reading, storing and submitting private PDF comics, books and lecture material.

The system includes a public comic catalog, authenticated user accounts, personal libraries, reading progress, PDF reading, user submissions, administrator review workflows, Gmail notifications and secure cloud storage.

## Live Application

Frontend:

https://comiclibraryapp.netlify.app

Backend API:

https://comic-library-api.onrender.com

The production application uses Netlify for the frontend, Render for the NestJS backend, MongoDB Atlas for the database and Amazon S3 for private file storage.

> The Render backend currently uses the free hosting tier, so the first request after a period of inactivity may take longer while the service starts.

## Main Features

- Public comic catalog with permanent cover images while the original PDF files remain private.

- Secure PDF reading through short-lived Amazon S3 signed URLs.

- User registration and login with username or e-mail.

- Personal comic library with add/remove functionality.

- Whole-section add/remove controls for comic collections.

- Reading progress tracking, continue-reading and reset-progress support.

- Search and filtering support for the comic catalog and personal library.

- Integrated PDF reader with:
  - Page navigation
  - Direct page selection
  - Current and total page display
  - Zoom controls
  - Fit-page
  - Fit-width
  - Fullscreen mode
  - Keyboard navigation
  - Responsive mobile support

- User PDF submission workflow.

- Administrator review queue for submitted comics.

- Administrator approval and rejection with optional notes.

- In-app notifications when a submission is approved or rejected.

- Gmail API notifications for administrators and request submitters.

- Drag-and-drop PDF uploads with upload progress.

- Automatic first-page cover generation for uploaded PDFs.

- Administrator comic creation, editing and deletion.

- Cover repair support for older PDF records.

- Browser-tab isolated sessions using `sessionStorage`, allowing a regular user account and an administrator account to remain signed in in separate tabs.

- Automatic catalog/user refresh when returning to an active browser tab.

## Technology Stack

### Frontend

- React 18
- React Router 7
- TypeScript
- Vite
- Tailwind CSS

### Backend

- NestJS 11
- Node.js
- Express
- Mongoose

### Database

- MongoDB
- MongoDB Atlas in production

### File Storage

- Private Amazon S3 bucket
- Short-lived signed URLs for protected files

### Authentication and Security

- JWT
- bcrypt
- Server-side role verification
- Rate limiting
- CORS restrictions
- CSP and security headers

### Notifications

- Gmail API using OAuth 2.0
- In-app notifications

## Application Architecture

The frontend communicates with the NestJS backend through HTTP API requests.

In production:

```text
User Browser
     |
     v
Netlify / React Frontend
     |
     v
Render / NestJS API
     |
     +------> MongoDB Atlas
     |
     +------> Private Amazon S3
     |
     +------> Gmail API
```

The frontend never receives AWS credentials or direct access to private S3 objects.

When an authenticated user opens a comic, the backend verifies the JWT and user permissions before generating a temporary signed S3 URL.

## Running Locally

### Requirements

Make sure the following are installed:

- Node.js
- npm
- MongoDB, or access to a MongoDB instance

Copy the environment example:

```bash
cp .env.example .env
```

Fill in the required environment variables and install dependencies:

```bash
npm install
```

Start the development environment:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:8080
```

The NestJS backend runs on:

```text
http://localhost:3000
```

The frontend proxies API requests to the backend during local development.

## Production-Style Local Run

Build the project:

```bash
npm run build
```

Start the server:

```bash
npm start
```

## Environment Variables

| Variable | Local / Development | Production |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/comic_library` | Required with authentication |
| `JWT_SECRET` | Development fallback is supported | Required, at least 48 characters |
| `PORT` | `3000` | Optional |
| `APP_URL` | `http://localhost:8080` | Required HTTPS frontend origin |
| `NODE_ENV` | `development` | `production` |
| `TRUST_PROXY` | Usually not required | `true` when running behind the production proxy |
| `S3_REGION` | Required when using S3 | Required |
| `AWS_S3_BUCKET` | Required when using S3 | Required |
| `S3_ACCESS_KEY_ID` | Required for local AWS credentials | Required when no temporary role mechanism is available |
| `S3_SECRET_ACCESS_KEY` | Required for local AWS credentials | Required when no temporary role mechanism is available |
| `GMAIL_CLIENT_ID` | Optional | Required for real Gmail notifications |
| `GMAIL_CLIENT_SECRET` | Optional | Required for real Gmail notifications |
| `GMAIL_REFRESH_TOKEN` | Optional | Required for real Gmail notifications |
| `GMAIL_SENDER_EMAIL` | Optional | Required for real Gmail notifications |
| `TEST_MAIL_TO` | Falls back to sender address | Optional |

For hosted production environments, temporary AWS credentials or IAM roles are preferred over long-lived AWS access keys whenever the hosting provider supports them.

Never commit real credentials, OAuth secrets, refresh tokens, JWT secrets, AWS keys or the production `.env` file to the repository.

## User Accounts

Regular users can create an account directly through the application's registration page.

Registration always creates a standard user account.

The client cannot select or assign the `admin` role during registration.

Administrator accounts must be created separately.

## Creating an Administrator

To bootstrap or reset an administrator account, temporarily add the following values to `.env`:

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

After the administrator account has been created, remove the `ADMIN_*` values from `.env`.

Do not commit administrator credentials to Git.

## Gmail API Notifications

Comic Library uses the Gmail API as its real e-mail delivery provider.

The backend uses the configured OAuth refresh token to request short-lived access tokens and sends messages using the Gmail API `gmail.send` scope.

A saved OAuth access token is not required because access tokens are generated from the refresh token when needed.

If Gmail API credentials are not configured in development, messages are written to:

```text
logs/mail/
```

instead of being sent.

### Submission Notifications

When a user submits a comic request:

- The request is stored in the database.
- Every administrator account with the `admin` role can receive a notification.
- Administrator e-mail addresses are read from the current MongoDB user records.
- Administrators can open the request and review it.

When an administrator approves or rejects a request:

- The request status is updated.
- An optional administrator note is stored.
- The submitting user receives an in-app notification.
- The submitting user can receive a Gmail notification.
- Mail delivery failure does not roll back an already completed approval, rejection or saved request.

After configuring Gmail values, restart the backend.

A successful startup should report that the Gmail OAuth credentials were verified.

A real test e-mail can be sent with:

```bash
TEST_MAIL_TO=recipient@example.com npm run mail:test
```

When Google's OAuth application remains in Testing mode, refresh-token lifetime may be affected by Google's testing-token policy.

A production deployment should therefore use an appropriate long-lived OAuth configuration.

## Security

Comic Library includes multiple security layers.

### Password Security

- Passwords are hashed with bcrypt.
- bcrypt uses a cost factor of 12.
- Password hashes are never returned by authentication API responses.

### JWT Security

- Production refuses to start without a `JWT_SECRET` of at least 48 characters.
- JWT sessions expire after 8 hours.
- Tokens use the expected issuer and audience.
- JWT verification is restricted to the configured signing algorithm.
- Protected requests verify that the user still exists.
- The backend loads the user's current role from MongoDB instead of trusting a role supplied by the client.

### Authorization

- Administrator endpoints are protected by backend authorization.
- Administrator pages are also protected in the frontend.
- Regular users cannot perform administrator actions.
- Users cannot access another user's private request information.
- Reading progress and personal library operations are associated with the authenticated user.

### Rate Limiting

Different API operations use different request limits.

Authentication routes use stricter limits to reduce brute-force attempts.

The application also includes limits for:

- Registration
- Login
- User submissions
- Reading progress updates
- API mutations
- Authentication state requests
- General API traffic

Production proxy configuration is enabled so that rate limiting can use the correct client IP address behind the hosting proxy.

### CORS

CORS is restricted to configured application origins.

Production does not use a wildcard origin.

Production requires the configured application URL to use HTTPS.

### Security Headers

The application configures security headers including:

- `X-Content-Type-Options`
- `X-Frame-Options`
- Referrer Policy
- Permissions Policy
- Cross-Origin policies
- Content Security Policy
- HTTP Strict Transport Security

The Express `X-Powered-By` header is disabled.

Sensitive API responses also use no-cache/no-store behavior.

### Content Security Policy

The production CSP restricts scripts and resources to approved sources and blocks unsafe object embedding and framing.

The frontend production CSP has also been verified on the deployed Netlify application.

### API Data Minimization

Public and authenticated APIs return only the information required by the frontend.

Examples include:

- Public catalog responses do not expose `pdfFile`.
- Private S3 object identifiers are not exposed unnecessarily.
- Authentication responses return only required user data.
- Request lists return summaries instead of complete internal records.
- Internal database fields and implementation details are removed from API responses where they are not needed.

### PDF and Upload Security

Uploaded PDF files are checked using more than only the browser-provided MIME type.

The backend reads the uploaded content and verifies the PDF file signature.

Uploads also use:

- File-size limits
- Field limits
- Generated file names
- Temporary staging outside the public web directory

Files are then streamed to Amazon S3.

### Amazon S3 Security

The production S3 bucket is private.

Block Public Access should remain enabled.

PDF files are not directly exposed through the public catalog.

Authenticated users receive temporary signed URLs only after backend authorization.

Catalog cover images are stored separately so the public catalog does not require access to the private PDF document.

AWS credentials remain server-side only.

### MongoDB Security

The production application uses MongoDB Atlas with authenticated database access.

The application database account is limited to the required application database instead of using unrestricted database permissions.

Production refuses to use an unauthenticated MongoDB URI.

### Dependency Security

Dependencies are checked using:

```bash
npm audit
```

Known dependency issues discovered during development were reviewed and updated.

At the latest final verification, the dependency audit reported:

```text
0 vulnerabilities
```

## Final Verification

Before a release or submission, run:

```bash
npm run verify
npm audit
```

`npm run verify` performs the project verification workflow, including:

- Frontend TypeScript checking
- Backend TypeScript checking
- Frontend production build
- Backend production build
- Automated test execution

The final verification should complete without errors before deployment.

## Production Deployment

The current production architecture is:

```text
Frontend:  Netlify
Backend:   Render
Database:  MongoDB Atlas
Files:     Amazon S3
E-mail:    Gmail API
```

Production uses HTTPS.

The Netlify frontend proxies API traffic to the Render backend.

Production environment variables are stored in the hosting platforms and are not committed to Git.

## S3 CORS

Keep Amazon S3 Block Public Access enabled.

Bucket CORS should allow only the frontend origins that need to access signed objects.

For example:

```text
http://localhost:8080
```

during local development, and the exact HTTPS production frontend origin:

```text
https://comiclibraryapp.netlify.app
```

for production.

Do not use unnecessarily broad origins when configuring the bucket.

## Project Verification Status

The final production version has been tested for the main workflows, including:

- User authentication
- Administrator authorization
- Public catalog access
- Personal library operations
- PDF reading
- Reading progress
- Comic upload
- User submission workflow
- Administrator approval and rejection
- Production database access
- Private S3 access
- Gmail notification flow
- Mobile PDF reader behavior
- Production deployment

The deployed application has also completed a final production smoke test successfully.