import { Injectable, Logger } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "fs";
import path from "path";
import crypto from "crypto";

export interface S3UploadResult {
  key: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly region = process.env.AWS_REGION;
  private readonly bucket = process.env.AWS_S3_BUCKET;
  private readonly accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  private readonly secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  private readonly client: S3Client;

  constructor() {
    if (!this.region || !this.bucket) {
      throw new Error(
        "Amazon S3 is not configured. Check AWS_REGION and AWS_S3_BUCKET in .env",
      );
    }

    const hasAccessKey = Boolean(this.accessKeyId);
    const hasSecretKey = Boolean(this.secretAccessKey);
    if (hasAccessKey !== hasSecretKey) {
      throw new Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must either both be set or both be omitted",
      );
    }

    this.client = new S3Client({
      region: this.region,
      ...(hasAccessKey && hasSecretKey
        ? {
            credentials: {
              accessKeyId: this.accessKeyId!,
              secretAccessKey: this.secretAccessKey!,
            },
          }
        : {}),
    });

    this.logger.log(
      `Amazon S3 storage is enabled (bucket: ${this.bucket}, region: ${this.region}).`,
    );
  }

  private makeKey(folder: string, fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    const base = path
      .basename(fileName, extension)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 100);
    return `${folder}/${Date.now()}-${crypto.randomUUID()}-${base || "file"}${extension}`;
  }

  async uploadFile(
    localFilePath: string,
    folder: string,
    contentType: string,
    originalName?: string,
  ): Promise<S3UploadResult> {
    const key = this.makeKey(
      folder,
      originalName || path.basename(localFilePath),
    );
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: createReadStream(localFilePath),
        ContentType: contentType,
        ContentDisposition: "inline",
        ServerSideEncryption: "AES256",
        CacheControl: contentType.startsWith("image/")
          ? "private, max-age=3600"
          : "private, no-store",
      }),
    );
    return { key };
  }

  uploadPdf(
    localFilePath: string,
    folder: string,
    originalName?: string,
  ): Promise<S3UploadResult> {
    return this.uploadFile(
      localFilePath,
      folder,
      "application/pdf",
      originalName,
    );
  }

  uploadCover(
    localFilePath: string,
    folder: string,
    contentType: string,
    originalName?: string,
  ): Promise<S3UploadResult> {
    return this.uploadFile(localFilePath, folder, contentType, originalName);
  }

  async getSignedUrl(key: string, expiresInSeconds = 1800): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket!, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  getSignedPdfUrl(key: string, expiresInSeconds = 1800): Promise<string> {
    return this.getSignedUrl(key, expiresInSeconds);
  }

  async deleteObject(key: string): Promise<void> {
    if (!key) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }),
      );
    } catch (error) {
      this.logger.error(`Failed to delete S3 object: ${key}`, error);
    }
  }

  deletePdf(key: string): Promise<void> {
    return this.deleteObject(key);
  }
}
