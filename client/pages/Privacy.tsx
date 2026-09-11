import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link
          to="/"
          className="mb-8 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Comic Library
        </Link>

        <h1 className="mb-2 text-4xl font-bold">Privacy Policy</h1>

        <p className="mb-10 text-muted-foreground">
          Last updated: September 11, 2026
        </p>

        <div className="space-y-8 leading-7">
          <section>
            <p>
              Comic Library respects the privacy of its users and is committed
              to protecting personal information.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">
              Information We May Collect
            </h2>

            <p>
              Comic Library may collect information that users voluntarily
              provide when using the service, such as account information,
              contact information, requests, messages, and other information
              required for the operation of the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">
              How We Use Information
            </h2>

            <p>
              We use collected information only for operating and improving
              Comic Library, managing user accounts, handling user requests,
              providing system notifications, and sending service-related
              emails.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">
              Google API Services
            </h2>

            <p className="mb-4">
              Comic Library uses the Google Gmail API solely to send
              transactional and system-related emails on behalf of Comic
              Library.
            </p>

            <p className="mb-4">
              The application requests only the permission required to send
              email. Comic Library does not use the Gmail API to read users'
              inboxes, access their email history, or collect email content
              from their Google accounts.
            </p>

            <p className="mb-4">
              Information obtained through Google APIs is used only to provide
              the functionality described above and is not sold or used for
              advertising purposes.
            </p>

            <p>
              Comic Library's use of information received from Google APIs
              complies with the Google API Services User Data Policy, including
              the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Data Sharing</h2>

            <p>
              Comic Library does not sell personal information. Information may
              only be shared with service providers when necessary to operate
              the service, host the application, deliver emails, or comply with
              legal obligations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Data Security</h2>

            <p>
              Reasonable technical and organizational measures are used to
              protect information from unauthorized access, disclosure,
              alteration, or destruction.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Data Retention</h2>

            <p>
              Information is retained only for as long as reasonably necessary
              to operate Comic Library, provide the service, and meet
              applicable legal or operational requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Contact</h2>

            <p>
              If you have questions regarding this Privacy Policy, contact us
              at{" "}
              <a
                href="mailto:comiclibrary380@gmail.com"
                className="underline underline-offset-4"
              >
                comiclibrary380@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};

export default Privacy;