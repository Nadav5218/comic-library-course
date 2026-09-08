import { HttpException, HttpStatus } from "@nestjs/common";
import { open } from "fs/promises";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const registerSchema = z.object({
  username: text(3, 40).regex(/^[\p{L}\p{N}._-]+$/u),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(8).max(128),
  phone: text(7, 30).regex(/^[+\d][\d\s().-]*$/),
});

export const loginSchema = z
  .object({
    username: z.string().trim().max(160).optional(),
    email: z.string().trim().max(160).optional(),
    password: z.string().min(1).max(128),
  })
  .refine((value) => Boolean(value.username || value.email), {
    message: "Username or email is required",
  });

export const comicFieldsSchema = z.object({
  title: text(1, 160),
  author: text(1, 120),
  year: z.coerce
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear() + 5),
  category: text(1, 100),
  description: z.string().trim().max(4000).optional().default(""),
  partNumber: z
    .union([z.coerce.number().int().positive().max(100000), z.null()])
    .optional(),
  partName: z.union([z.string().trim().max(120), z.null()]).optional(),
});


export const adminNoteSchema = z
  .union([z.string().trim().max(1200), z.null()])
  .optional();

export const progressSchema = z.object({
  page: z.coerce.number().int().min(0).max(1000000),
  totalPages: z.coerce.number().int().min(0).max(1000000).optional(),
});

export const groupUpdateSchema = z.object({
  category: text(1, 100),
  partName: z.string().trim().max(120).nullable().optional(),
  action: z.enum(["add", "remove"]),
});

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const message = result.error.issues[0]?.message || "Invalid request data";
  throw new HttpException(
    { success: false, error: message },
    HttpStatus.BAD_REQUEST,
  );
}

export function assertObjectId(value: string, label = "id"): void {
  if (!isValidObjectId(value)) {
    throw new HttpException(
      { success: false, error: `Invalid ${label}` },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function assertUploadSize(
  file: Express.Multer.File,
  maxBytes: number,
  label: string,
): void {
  if (!file || file.size <= 0 || file.size > maxBytes) {
    throw new HttpException(
      { success: false, error: `${label} exceeds the allowed size` },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export async function assertPdfFile(filePath: string): Promise<void> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (
      bytesRead < 5 ||
      buffer.subarray(0, bytesRead).indexOf(Buffer.from("%PDF-")) < 0
    ) {
      throw new HttpException(
        { success: false, error: "The uploaded file is not a valid PDF" },
        HttpStatus.BAD_REQUEST,
      );
    }
  } finally {
    await handle.close();
  }
}

export async function assertImageFile(filePath: string): Promise<void> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, 12, 0);
    const isPng =
      bytesRead >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg =
      bytesRead >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const isWebp =
      bytesRead >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isJpeg && !isWebp) {
      throw new HttpException(
        { success: false, error: "The uploaded cover is not a valid image" },
        HttpStatus.BAD_REQUEST,
      );
    }
  } finally {
    await handle.close();
  }
}
