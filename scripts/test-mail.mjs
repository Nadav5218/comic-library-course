const gmail = {
  clientId: process.env.GMAIL_CLIENT_ID?.trim() || "",
  clientSecret: process.env.GMAIL_CLIENT_SECRET?.trim() || "",
  refreshToken: process.env.GMAIL_REFRESH_TOKEN?.trim() || "",
  senderEmail: process.env.GMAIL_SENDER_EMAIL?.trim() || "",
};

const missing = Object.entries(gmail)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length) {
  console.error(
    `Gmail API configuration is incomplete. Missing: ${missing.join(", ")}`,
  );
  process.exit(1);
}

const to = process.env.TEST_MAIL_TO?.trim() || gmail.senderEmail;
const accessToken = await getAccessToken(gmail);
const from = `Comic Library <${gmail.senderEmail}>`;
const subject = "Comic Library Gmail API test";
const text = "Comic Library Gmail API delivery is configured correctly.";
const html = "<p>Comic Library Gmail API delivery is configured correctly.</p>";
const raw = buildRawMessage(from, to, subject, text, html);
const response = await fetch(
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  },
);
const responseText = await response.text();
if (!response.ok) {
  console.error(
    `Gmail API test send failed with HTTP ${response.status}: ${responseText}`,
  );
  process.exit(1);
}

const payload = JSON.parse(responseText);
console.log(
  `Gmail API test e-mail sent to ${to}${payload.id ? ` (messageId=${payload.id})` : ""}`,
);

async function getAccessToken(config) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `OAuth token refresh failed with HTTP ${response.status}: ${responseText}`,
    );
  }
  const payload = JSON.parse(responseText);
  if (!payload.access_token) {
    throw new Error("OAuth token refresh returned no access token.");
  }
  return payload.access_token;
}

function encodeHeader(value) {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function buildRawMessage(from, recipient, subject, text, html) {
  const boundary = `comic-library-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const message = [
    `From: ${from}`,
    `To: ${recipient}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(text, "utf8").toString("base64")),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(html, "utf8").toString("base64")),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
