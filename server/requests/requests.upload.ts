import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { diskStorage } from "multer";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

export const requestUploadDir = path.join(
  os.tmpdir(),
  "comic-library-requests",
);

export async function ensureRequestUploadDir(): Promise<void> {
  await fs.mkdir(requestUploadDir, { recursive: true });
}

void ensureRequestUploadDir();

export const requestUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureRequestUploadDir();
        cb(null, requestUploadDir);
      } catch (error) {
        cb(error as Error, requestUploadDir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = file.fieldname === "coverImage" ? ".webp" : ".pdf";
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "pdfFile") {
      cb(null, file.mimetype === "application/pdf");
      return;
    }
    if (file.fieldname === "coverImage") {
      cb(
        null,
        ["image/webp", "image/jpeg", "image/png"].includes(file.mimetype),
      );
      return;
    }
    cb(null, false);
  },
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 2,
    fields: 12,
    parts: 14,
    fieldNameSize: 64,
    fieldSize: 64 * 1024,
    headerPairs: 100,
    fieldNestingDepth: 2,
  } as any,
};
