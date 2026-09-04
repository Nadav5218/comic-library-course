import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { ComicRequestStatus } from "@shared/api";
import { S3Service } from "../s3/s3.service";
import {
  ComicRequest,
  ComicRequestDocument,
} from "../schemas/comic-request.schema";
import { Comic, ComicDocument } from "../schemas/comic.schema";
import { User, UserDocument } from "../schemas/user.schema";
import type { AuthUser } from "../common/types";
import { MailService } from "../mail/mail.service";
import {
  assertImageFile,
  assertObjectId,
  assertPdfFile,
  assertUploadSize,
  adminNoteSchema,
  comicFieldsSchema,
  parseOrThrow,
} from "../common/validation";
import { CreateRequestDto } from "./dto/create-request.dto";
import { ReviewRequestDto } from "./dto/review-request.dto";

const STATUSES: ComicRequestStatus[] = ["pending", "approved", "rejected"];
const REQUEST_PDF_FOLDER = "requests";
const REQUEST_COVER_FOLDER = "request-covers";

type RequestFiles = {
  pdfFile?: Express.Multer.File;
  coverImage?: Express.Multer.File;
};

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectModel(ComicRequest.name)
    private readonly requestModel: Model<ComicRequest>,
    @InjectModel(Comic.name)
    private readonly comicModel: Model<Comic>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly mailService: MailService,
    private readonly s3: S3Service,
  ) {}

  private async removeTemp(file?: Express.Multer.File) {
    if (!file?.path) return;
    await fs.unlink(file.path).catch(() => undefined);
  }

  private normalizeFields(
    dto: CreateRequestDto | ReviewRequestDto,
    requireAll: boolean,
  ) {
    const source: any = { ...dto };
    if (source.partNumber === "" || source.partNumber === undefined)
      source.partNumber = null;
    if (source.partName === "") source.partName = null;
    if (requireAll) return parseOrThrow(comicFieldsSchema, source);

    const result: any = {};
    const keys = [
      "title",
      "author",
      "year",
      "category",
      "description",
      "partNumber",
      "partName",
    ];
    for (const key of keys) {
      if (source[key] === undefined) continue;
      const defaults = {
        title: "placeholder",
        author: "placeholder",
        year: 2000,
        category: "placeholder",
        description: "",
        partNumber: null,
        partName: null,
      } as any;
      result[key] = (
        parseOrThrow(comicFieldsSchema, {
          ...defaults,
          [key]: source[key],
        }) as any
      )[key];
    }
    return result;
  }

  private normalizeAdminNote(value: unknown): string | null | undefined {
    const parsed = parseOrThrow(adminNoteSchema, value);
    if (parsed === undefined) return undefined;
    if (parsed === null) return null;
    return parsed.trim() || null;
  }

  private async loadOrFail(id: string) {
    assertObjectId(id, "request id");
    const request = await this.requestModel.findById(id);
    if (!request) {
      throw new HttpException(
        { success: false, error: "Request not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    return request;
  }

  private async requestToResponse(
    request: ComicRequestDocument,
    includePdf = false,
  ) {
    const data: any = request.toObject();
    if (includePdf && data.status === "pending") {
      if (
        typeof data.pdfFile === "string" &&
        data.pdfFile.startsWith("s3://")
      ) {
        const key = data.pdfPublicId || data.pdfFile.replace("s3://", "");
        data.pdfFile = key ? await this.s3.getSignedPdfUrl(key, 1800) : null;
      }
    } else {
      data.pdfFile = null;
    }
    if (
      typeof data.coverImage === "string" &&
      data.coverImage.startsWith("s3://")
    ) {
      const key = data.coverPublicId || data.coverImage.replace("s3://", "");
      data.coverImage = key ? await this.s3.getSignedUrl(key, 3600) : null;
    }
    delete data.pdfPublicId;
    delete data.coverPublicId;
    delete data.reviewLock;
    delete data.reviewLockExpiresAt;
    return data;
  }

  private async requestToSummary(
    request: ComicRequestDocument,
    includeRequester = false,
  ) {
    let coverImage: string | null = request.coverImage || null;

    if (
      typeof coverImage === "string" &&
      coverImage.startsWith("s3://")
    ) {
      const key =
        request.coverPublicId || coverImage.replace("s3://", "");
      coverImage = key ? await this.s3.getSignedUrl(key, 3600) : null;
    }

    return {
      _id: request._id.toString(),
      ...(includeRequester
        ? {
            requesterUsername: request.requesterUsername,
            requesterEmail: request.requesterEmail,
          }
        : {}),
      title: request.title,
      author: request.author,
      year: request.year,
      category: request.category,
      coverImage,
      status: request.status,
      approvedComicId: request.approvedComicId
        ? request.approvedComicId.toString()
        : null,
      adminNote: request.adminNote ?? null,
      createdAt: request.createdAt,
    };
  }

  private async addNotification(
    userId: any,
    title: string,
    message: string,
    type: string,
    link?: string,
  ) {
    try {
      await this.userModel.updateOne(
        { _id: userId },
        {
          $push: {
            notifications: {
              $each: [
                {
                  title,
                  message,
                  type,
                  link: link || null,
                  read: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ],
              $position: 0,
              $slice: 100,
            },
          },
        },
      );
    } catch (error) {
      this.logger.warn(`Unable to store notification: ${String(error)}`);
    }
  }

  private async notifyAdminsAboutSubmission(request: ComicRequestDocument) {
    try {
      const admins = await this.userModel
        .find({ role: "admin" })
        .select("_id username email")
        .lean();

      const reviewPath = `/requests/${request._id.toString()}`;
      const reviewUrl = `${this.mailService.appUrl}/login?from=${encodeURIComponent(reviewPath)}`;
      const mailData = {
        requestId: request._id.toString(),
        requesterUsername: request.requesterUsername || request.requesterEmail,
        requesterEmail: request.requesterEmail,
        requesterPhone: request.requesterPhone || undefined,
        title: request.title,
        author: request.author,
        year: request.year,
        category: request.category,
        partName: request.partName,
        partNumber: request.partNumber,
        reviewUrl,
      };

      const adminRecipients = Array.from(
        new Map(
          admins
            .map((admin) => ({
              email: String(admin.email || "").trim(),
            }))
            .filter((admin) => admin.email)
            .map((admin) => [admin.email.toLowerCase(), admin] as const),
        ).values(),
      );

      const mailResults = await Promise.all(
        adminRecipients.map(async (admin) => ({
          email: admin.email,
          sent: await this.mailService.sendNewSubmissionToAdmin(
            admin.email,
            mailData,
          ),
        })),
      );
      const sentCount = mailResults.filter((result) => result.sent).length;
      const failedRecipients = mailResults
        .filter((result) => !result.sent)
        .map((result) => result.email);

      if (adminRecipients.length === 0) {
        this.logger.warn(
          `New request ${request._id.toString()} was saved, but there are no administrator accounts with an e-mail address in MongoDB.`,
        );
      } else if (failedRecipients.length > 0) {
        this.logger.warn(
          `New request ${request._id.toString()} was saved, but e-mail failed for administrator account(s): ${failedRecipients.join(", ")}.`,
        );
      }

      await Promise.all(
        admins.map((admin) =>
          this.addNotification(
            admin._id,
            "New submission",
            `“${request.title}” was submitted by ${request.requesterUsername || request.requesterEmail}.`,
            "submission",
            reviewPath,
          ),
        ),
      );

      return sentCount > 0;
    } catch (error) {
      this.logger.warn(`Unable to notify administrators: ${String(error)}`);
      return false;
    }
  }

  private async resolveRequesterContact(request: ComicRequestDocument) {
    try {
      const user = await this.userModel
        .findById(request.requestedBy)
        .select("username email")
        .lean();
      const currentEmail = user?.email ? String(user.email).trim() : "";
      const currentUsername = user?.username
        ? String(user.username).trim()
        : request.requesterUsername || request.requesterEmail;
      if (currentEmail) {
        return { email: currentEmail, username: currentUsername };
      }
    } catch (error) {
      this.logger.warn(
        `Unable to refresh requester contact for request ${request._id.toString()}: ${String(error)}`,
      );
    }
    return {
      email: request.requesterEmail?.trim() || "",
      username: request.requesterUsername || request.requesterEmail,
    };
  }

  private async acquireReview(id: string) {
    assertObjectId(id, "request id");
    const now = new Date();
    const lock = crypto.randomUUID();
    const filter = {
      _id: id,
      status: "pending" as const,
      $or: [
        { reviewLock: null },
        { reviewLock: mongoose.trusted({ $exists: false }) },
        { reviewLockExpiresAt: mongoose.trusted({ $lte: now }) },
      ],
    };
    const request = await this.requestModel.findOneAndUpdate(
      filter,
      {
        $set: {
          reviewLock: lock,
          reviewLockExpiresAt: new Date(now.getTime() + 5 * 60_000),
        },
      },
      { returnDocument: "after" },
    );
    if (!request) {
      throw new HttpException(
        {
          success: false,
          error: "Request is already being reviewed or was completed",
        },
        HttpStatus.CONFLICT,
      );
    }
    return { request, lock };
  }

  private async releaseReview(id: string, lock: string) {
    await this.requestModel.updateOne(
      { _id: id, status: "pending", reviewLock: lock },
      { $set: { reviewLock: null, reviewLockExpiresAt: null } },
    );
  }

  async create(dto: CreateRequestDto, files: RequestFiles, authUser: AuthUser) {
    let pdfKey: string | null = null;
    let coverKey: string | null = null;
    try {
      const fields = this.normalizeFields(dto, true);
      const pdf = files.pdfFile;
      if (!pdf) {
        throw new HttpException(
          { success: false, error: "A PDF file is required" },
          HttpStatus.BAD_REQUEST,
        );
      }
      assertUploadSize(pdf, 100 * 1024 * 1024, "PDF");
      await assertPdfFile(pdf.path);
      const user = await this.userModel.findById(authUser.id);
      if (!user) {
        throw new HttpException(
          { success: false, error: "User not found" },
          HttpStatus.NOT_FOUND,
        );
      }

      const savedPdf = await this.s3.uploadPdf(
        pdf.path,
        REQUEST_PDF_FOLDER,
        pdf.originalname,
      );
      pdfKey = savedPdf.key;
      await this.removeTemp(pdf);

      let coverImage: string | null = null;
      let coverPublicId: string | null = null;
      if (files.coverImage) {
        assertUploadSize(files.coverImage, 8 * 1024 * 1024, "Cover image");
        await assertImageFile(files.coverImage.path);
        const savedCover = await this.s3.uploadCover(
          files.coverImage.path,
          REQUEST_COVER_FOLDER,
          files.coverImage.mimetype,
          files.coverImage.originalname || "cover.webp",
        );
        coverKey = savedCover.key;
        coverImage = `s3://${savedCover.key}`;
        coverPublicId = savedCover.key;
        await this.removeTemp(files.coverImage);
      }

      const request = new this.requestModel({
        requestedBy: user._id,
        requesterUsername: user.username,
        requesterEmail: user.email,
        requesterPhone: user.phone || "",
        ...fields,
        pdfFile: `s3://${savedPdf.key}`,
        pdfPublicId: savedPdf.key,
        coverImage,
        coverPublicId,
        originalFileName: pdf.originalname,
        status: "pending",
      });
      await request.save();
      pdfKey = null;
      coverKey = null;
      const adminMailSent = await this.notifyAdminsAboutSubmission(request);
      return {
        success: true,
        data: {
          request: await this.requestToResponse(request),
          adminMailSent,
        },
      };
    } catch (error) {
      await this.removeTemp(files.pdfFile);
      await this.removeTemp(files.coverImage);
      if (pdfKey) await this.s3.deleteObject(pdfKey);
      if (coverKey) await this.s3.deleteObject(coverKey);
      if (error instanceof HttpException) throw error;
      this.logger.error("Error creating request", error);
      throw new HttpException(
        { success: false, error: "Failed to submit request" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findMine(authUser: AuthUser) {
    const requests = await this.requestModel
      .find({ requestedBy: authUser.id })
      .sort({ createdAt: -1 });
    return {
      success: true,
      data: {
        requests: await Promise.all(
          requests.map((item) => this.requestToSummary(item)),
        ),
      },
    };
  }

  async countPending() {
    const pending = await this.requestModel.countDocuments({
      status: "pending",
    });
    return { success: true, data: { pending } };
  }

  async findAll(status?: string) {
    const normalizedStatus =
      status && STATUSES.includes(status as ComicRequestStatus)
        ? (status as ComicRequestStatus)
        : undefined;

    const requests = normalizedStatus
      ? await this.requestModel
          .find({ status: normalizedStatus })
          .sort({ createdAt: -1 })
      : await this.requestModel.find().sort({ createdAt: -1 });
    return {
      success: true,
      data: {
        requests: await Promise.all(
          requests.map((item) => this.requestToSummary(item, true)),
        ),
      },
    };
  }

  async findOne(id: string, authUser: AuthUser) {
    const request = await this.loadOrFail(id);
    const isOwner = request.requestedBy.toString() === authUser.id;
    if (!isOwner && authUser.role !== "admin") {
      throw new HttpException(
        { success: false, error: "Forbidden" },
        HttpStatus.FORBIDDEN,
      );
    }
    return {
      success: true,
      data: { request: await this.requestToResponse(request, true) },
    };
  }

  async update(id: string, dto: ReviewRequestDto) {
    const request = await this.loadOrFail(id);
    if (request.status !== "pending") {
      throw new HttpException(
        { success: false, error: "Request has already been reviewed" },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      request.reviewLock &&
      request.reviewLockExpiresAt &&
      request.reviewLockExpiresAt.getTime() > Date.now()
    ) {
      throw new HttpException(
        { success: false, error: "Request is currently being reviewed" },
        HttpStatus.CONFLICT,
      );
    }
    Object.assign(request, this.normalizeFields(dto, false));
    if (dto.adminNote !== undefined) {
      request.adminNote = this.normalizeAdminNote(dto.adminNote) ?? null;
    }
    await request.save();
    return {
      success: true,
      data: { request: await this.requestToResponse(request, true) },
    };
  }

  async approve(id: string, dto: ReviewRequestDto, authUser: AuthUser) {
    let lock: string | null = null;
    let createdComic: ComicDocument | null = null;
    let committed = false;

    try {
      const acquired = await this.acquireReview(id);
      const request = acquired.request;
      lock = acquired.lock;
      Object.assign(request, this.normalizeFields(dto, false));
      if (dto.adminNote !== undefined) {
        request.adminNote = this.normalizeAdminNote(dto.adminNote) ?? null;
      }

      if (
        typeof request.pdfFile !== "string" ||
        !request.pdfFile.startsWith("s3://")
      ) {
        throw new HttpException(
          {
            success: false,
            error: "This legacy request must be uploaded again before approval",
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      createdComic = await this.comicModel.create({
        title: request.title,
        author: request.author,
        year: request.year,
        category: request.category,
        pdfFile: request.pdfFile,
        pdfPublicId: request.pdfPublicId,
        coverImage: request.coverImage || null,
        coverPublicId: request.coverPublicId || null,
        description: request.description || "",
        partNumber: request.partNumber ?? null,
        partName: request.partName ?? null,
      });

      request.status = "approved";
      request.reviewedBy = authUser.id as any;
      request.reviewedAt = new Date();
      request.approvedComicId = createdComic._id as any;
      request.reviewLock = null;
      request.reviewLockExpiresAt = null;
      await request.save();
      committed = true;
      lock = null;

      const comicId = createdComic._id.toString();
      const comicUrl = `${this.mailService.appUrl}/comic/${comicId}`;
      const requester = await this.resolveRequesterContact(request);
      const mailSent = await this.mailService.sendRequestApproved(
        requester.email,
        {
          title: request.title,
          comicUrl,
          requesterUsername: requester.username,
          adminNote: request.adminNote || undefined,
        },
      );
      if (!mailSent) {
        this.logger.warn(
          `Request ${request._id.toString()} was approved, but the user e-mail was not sent to ${requester.email || "<missing recipient>"}.`,
        );
      }

      await this.addNotification(
        request.requestedBy,
        "Submission approved",
        request.adminNote
          ? `“${request.title}” is now available in the library. Note: ${request.adminNote}`
          : `“${request.title}” is now available in the library.`,
        "approved",
        `/comic/${comicId}`,
      );

      return {
        success: true,
        data: {
          requestId: request._id.toString(),
          comicId,
          status: "approved",
          mailSent,
        },
      };
    } catch (error) {
      if (!committed && createdComic) {
        await this.comicModel
          .deleteOne({ _id: createdComic._id })
          .catch(() => undefined);
      }
      if (lock) await this.releaseReview(id, lock).catch(() => undefined);
      if (error instanceof HttpException) throw error;
      this.logger.error("Error approving request", error);
      throw new HttpException(
        { success: false, error: "Failed to approve request" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async reject(id: string, dto: ReviewRequestDto, authUser: AuthUser) {
    let lock: string | null = null;

    try {
      const acquired = await this.acquireReview(id);
      const request = acquired.request;
      lock = acquired.lock;
      if (dto.adminNote !== undefined) {
        request.adminNote = this.normalizeAdminNote(dto.adminNote) ?? null;
      }
      const pdfKey =
        request.pdfPublicId ||
        (typeof request.pdfFile === "string" &&
        request.pdfFile.startsWith("s3://")
          ? request.pdfFile.replace("s3://", "")
          : null);
      const coverKey =
        request.coverPublicId ||
        (typeof request.coverImage === "string" &&
        request.coverImage.startsWith("s3://")
          ? request.coverImage.replace("s3://", "")
          : null);

      request.status = "rejected";
      request.reviewedBy = authUser.id as any;
      request.reviewedAt = new Date();
      request.reviewLock = null;
      request.reviewLockExpiresAt = null;
      request.pdfFile = null;
      request.pdfPublicId = null;
      request.coverImage = null;
      request.coverPublicId = null;
      await request.save();
      lock = null;

      await Promise.all([
        pdfKey ? this.s3.deleteObject(pdfKey) : Promise.resolve(),
        coverKey ? this.s3.deleteObject(coverKey) : Promise.resolve(),
      ]);

      const requester = await this.resolveRequesterContact(request);
      const mailSent = await this.mailService.sendRequestRejected(
        requester.email,
        {
          title: request.title,
          requesterUsername: requester.username,
          requestsUrl: `${this.mailService.appUrl}/my-requests`,
          adminNote: request.adminNote || undefined,
        },
      );
      if (!mailSent) {
        this.logger.warn(
          `Request ${request._id.toString()} was rejected, but the user e-mail was not sent to ${requester.email || "<missing recipient>"}.`,
        );
      }
      await this.addNotification(
        request.requestedBy,
        "Submission reviewed",
        request.adminNote
          ? `“${request.title}” was not approved. Reason: ${request.adminNote}`
          : `“${request.title}” was not approved. You can review the submission details and try again.`,
        "rejected",
        "/my-requests",
      );

      return {
        success: true,
        data: {
          requestId: request._id.toString(),
          status: "rejected",
          mailSent,
        },
      };
    } catch (error) {
      if (lock) await this.releaseReview(id, lock).catch(() => undefined);
      if (error instanceof HttpException) throw error;
      this.logger.error("Error rejecting request", error);
      throw new HttpException(
        { success: false, error: "Failed to reject request" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
