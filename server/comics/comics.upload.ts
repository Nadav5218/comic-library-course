import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { diskStorage } from "multer";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

export const uploadDir = path.join(os.tmpdir(), "comic-library-uploads");

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(uploadDir, { recursive: true });
}

void ensureUploadDir();

export const comicUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureUploadDir();
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, uploadDir);
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
