import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { promises as fs } from "fs";
import path from "path";

export interface ApprovedMailData {
  title: string;
  comicUrl: string;
  requesterUsername: string;
  adminNote?: string;
}

export interface RejectedMailData {
  title: string;
  requesterUsername: string;
  requestsUrl: string;
  adminNote?: string;
}

export interface NewSubmissionMailData {
  requestId: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterPhone?: string;
  title: string;
  author: string;
  year: number;
  category: string;
  partName?: string | null;
  partNumber?: number | null;
  reviewUrl: string;
}

type GmailApiConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly gmailApi: GmailApiConfig | null;
  private gmailAccessToken: string | null = null;
  private gmailAccessTokenExpiresAt = 0;

  constructor() {
    const values: GmailApiConfig = {
      clientId: process.env.GMAIL_CLIENT_ID?.trim() || "",
      clientSecret: process.env.GMAIL_CLIENT_SECRET?.trim() || "",
      refreshToken: process.env.GMAIL_REFRESH_TOKEN?.trim() || "",
      senderEmail: process.env.GMAIL_SENDER_EMAIL?.trim() || "",
    };
    const configured = Object.values(values).every(Boolean);
    const partial = Object.values(values).some(Boolean);

    this.gmailApi = configured ? values : null;
    if (configured) {
      this.logger.log(
        `Gmail API configured for ${values.senderEmail} — e-mails will be sent through Gmail API.`,
      );
      return;
    }

    const missing = [
      !values.clientId ? "GMAIL_CLIENT_ID" : null,
      !values.clientSecret ? "GMAIL_CLIENT_SECRET" : null,
      !values.refreshToken ? "GMAIL_REFRESH_TOKEN" : null,
      !values.senderEmail ? "GMAIL_SENDER_EMAIL" : null,
    ].filter(Boolean);
    this.logger.warn(
      `${partial ? "Gmail API configuration is incomplete" : "Gmail API is not configured"} (${missing.join(", ")}) — e-mails will be written to logs/mail/ instead of being sent.`,
    );
  }

  async onModuleInit() {
    if (!this.gmailApi) return;
    try {
      await this.getGmailAccessToken(true);
      this.logger.log("Gmail API OAuth credentials verified successfully.");
    } catch (error) {
      this.logger.error(
        `Gmail API OAuth verification failed: ${this.describeError(error)}. Check GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN.`,
      );
    }
  }

  private get from(): string {
    if (this.gmailApi) return `Comic Library <${this.gmailApi.senderEmail}>`;
    return "Comic Library <no-reply@comic-library.local>";
  }

  get appUrl(): string {
    return (process.env.APP_URL || "http://localhost:8080").replace(/\/+$/, "");
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    const recipient = to?.trim();
    if (!recipient) {
      this.logger.warn(`No recipient for "${subject}" — skipped.`);
      return false;
    }

    try {
      if (!this.gmailApi) {
        await this.writeToOutbox(recipient, subject, html);
        return false;
      }
      return await this.sendWithGmailApi(recipient, subject, html);
    } catch (error) {
      this.logger.error(
        `Failed to send mail to ${recipient}: ${subject}. ${this.describeError(error)}`,
      );
      return false;
    }
  }

  private async sendWithGmailApi(
    recipient: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    const raw = buildRawMessage(
      this.from,
      recipient,
      subject,
      htmlToText(html),
      html,
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accessToken = await this.getGmailAccessToken(attempt > 0);
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

      if (response.status === 401 && attempt === 0) {
        this.gmailAccessToken = null;
        this.gmailAccessTokenExpiresAt = 0;
        continue;
      }

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          `Gmail API send failed with HTTP ${response.status}: ${responseText.slice(0, 800)}`,
        );
      }

      let messageId = "";
      try {
        const payload = JSON.parse(responseText) as { id?: string };
        messageId = payload.id || "";
      } catch {}

      this.logger.log(
        `Mail sent through Gmail API to ${recipient}: ${subject}${messageId ? ` (messageId=${messageId})` : ""}`,
      );
      return true;
    }

    return false;
  }

  private async getGmailAccessToken(forceRefresh = false): Promise<string> {
    if (!this.gmailApi) throw new Error("Gmail API is not configured");

    if (
      !forceRefresh &&
      this.gmailAccessToken &&
      Date.now() < this.gmailAccessTokenExpiresAt
    ) {
      return this.gmailAccessToken;
    }

    const body = new URLSearchParams({
      client_id: this.gmailApi.clientId,
      client_secret: this.gmailApi.clientSecret,
      refresh_token: this.gmailApi.refreshToken,
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
        `OAuth token refresh failed with HTTP ${response.status}: ${responseText.slice(0, 800)}`,
      );
    }

    const payload = JSON.parse(responseText) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!payload.access_token) {
      throw new Error("OAuth token refresh succeeded without an access token");
    }

    this.gmailAccessToken = payload.access_token;
    const expiresIn = Math.max(Number(payload.expires_in || 3600) - 90, 60);
    this.gmailAccessTokenExpiresAt = Date.now() + expiresIn * 1000;
    return payload.access_token;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async writeToOutbox(to: string, subject: string, html: string) {
    const dir = path.join(process.cwd(), "logs", "mail");
    await fs.mkdir(dir, { recursive: true });
    const safeTo = to.replace(/[^a-zA-Z0-9._-]/g, "_");
    const file = path.join(dir, `${Date.now()}-${safeTo}.html`);
    const header =
      `<!--\n` +
      `  From:    ${this.from}\n` +
      `  To:      ${to}\n` +
      `  Subject: ${subject}\n` +
      `-->\n`;
    await fs.writeFile(file, header + html, "utf8");
    this.logger.log(`[demo mode] Mail for ${to} written to ${file}`);
  }

  private layout(title: string, bodyHtml: string): string {
    return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4efe6;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
    <div style="max-width:600px;margin:0 auto;background:#fffdf8;border:1px solid #e7dfd3;border-radius:20px;padding:32px;box-shadow:0 12px 40px rgba(17,24,39,.08);">
      <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#3157d5;margin-bottom:12px;">Comic Library</div>
      <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;">${title}</h1>
      ${bodyHtml}
      <p style="margin:32px 0 0;padding-top:20px;border-top:1px solid #ece7df;font-size:12px;color:#667085;">Read. Collect. Continue.</p>
    </div>
  </body>
</html>`;
  }

  private button(href: string, label: string): string {
    return `<p style="margin:24px 0;">
      <a href="${escapeHtml(href)}" style="display:inline-block;background:#3157d5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">${escapeHtml(label)}</a>
    </p>`;
  }

  async sendNewSubmissionToAdmin(
    to: string,
    data: NewSubmissionMailData,
  ): Promise<boolean> {
    const part = [
      data.partName ? escapeHtml(data.partName) : "",
      data.partNumber != null ? `#${data.partNumber}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const html = this.layout(
      "New comic submission",
      `<p style="margin:0 0 18px;line-height:1.65;color:#475467;">
         A new PDF was submitted and is waiting for administrator review.
       </p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5;">
         <tr><td style="padding:8px 0;color:#667085;">Request ID</td><td style="padding:8px 0;font-weight:700;text-align:right;">${escapeHtml(data.requestId)}</td></tr>
         <tr><td style="padding:8px 0;color:#667085;">Title</td><td style="padding:8px 0;font-weight:700;text-align:right;">${escapeHtml(data.title)}</td></tr>
         <tr><td style="padding:8px 0;color:#667085;">Author</td><td style="padding:8px 0;font-weight:700;text-align:right;">${escapeHtml(data.author)}</td></tr>
         <tr><td style="padding:8px 0;color:#667085;">Year</td><td style="padding:8px 0;font-weight:700;text-align:right;">${data.year}</td></tr>
         <tr><td style="padding:8px 0;color:#667085;">Series</td><td style="padding:8px 0;font-weight:700;text-align:right;">${escapeHtml(data.category)}</td></tr>
         ${part ? `<tr><td style="padding:8px 0;color:#667085;">Part</td><td style="padding:8px 0;font-weight:700;text-align:right;">${part}</td></tr>` : ""}
         <tr><td style="padding:8px 0;color:#667085;">Submitted by</td><td style="padding:8px 0;font-weight:700;text-align:right;">${escapeHtml(data.requesterUsername)}</td></tr>
         <tr><td style="padding:8px 0;color:#667085;">User e-mail</td><td style="padding:8px 0;font-weight:700;text-align:right;">${escapeHtml(data.requesterEmail)}</td></tr>
         ${data.requesterPhone ? `<tr><td style="padding:8px 0;color:#667085;">Phone</td><td style="padding:8px 0;font-weight:700;text-align:right;">${escapeHtml(data.requesterPhone)}</td></tr>` : ""}
       </table>
       ${this.button(data.reviewUrl, "Review submission")}`,
    );

    return this.send(
      to,
      `New submission from ${data.requesterUsername}: ${data.title}`,
      html,
    );
  }

  async sendRequestApproved(
    to: string,
    data: ApprovedMailData,
  ): Promise<boolean> {
    const html = this.layout(
      "Your submission was approved",
      `<p style="margin:0 0 12px;line-height:1.6;">
         Hi ${escapeHtml(data.requesterUsername)}, your request to add <strong>${escapeHtml(data.title)}</strong> to Comic Library was approved and the file is now available.
       </p>
       ${data.adminNote ? `<div style="margin:18px 0;padding:14px 16px;border-radius:14px;background:#f3f6ff;color:#344054;line-height:1.6;"><strong>Administrator note:</strong><br>${escapeHtml(data.adminNote)}</div>` : ""}
       ${this.button(data.comicUrl, "Open in Comic Library")}
       <p style="margin:24px 0 0;line-height:1.6;color:#475467;">Thank you for contributing to the library.</p>`,
    );
    return this.send(to, "Your Comic Library request was approved", html);
  }

  async sendRequestRejected(
    to: string,
    data: RejectedMailData,
  ): Promise<boolean> {
    const html = this.layout(
      "Your submission was not approved",
      `<p style="margin:0 0 12px;line-height:1.6;">
         Hi ${escapeHtml(data.requesterUsername)}, your request to add <strong>${escapeHtml(data.title)}</strong> to Comic Library was reviewed.
       </p>
       <p style="margin:0;line-height:1.6;color:#475467;">
         The request was not approved this time. You can review your requests or submit another title whenever you want.
       </p>
       ${data.adminNote ? `<div style="margin:18px 0;padding:14px 16px;border-radius:14px;background:#fff1f0;color:#7a271a;line-height:1.6;"><strong>Reason / administrator note:</strong><br>${escapeHtml(data.adminNote)}</div>` : ""}
       ${this.button(data.requestsUrl, "View my requests")}`,
    );
    return this.send(to, "Your Comic Library request was not approved", html);
  }
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function buildRawMessage(
  from: string,
  to: string,
  subject: string,
  text: string,
  html: string,
): string {
  const boundary = `comic-library-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
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
function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, ": ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
