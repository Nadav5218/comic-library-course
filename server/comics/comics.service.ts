import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { promises as fs } from "fs";
import path from "path";
import { S3Service } from "../s3/s3.service";
import { Comic, ComicDocument } from "../schemas/comic.schema";
import { User } from "../schemas/user.schema";
import type { AuthUser } from "../common/types";
import {
  assertImageFile,
  assertObjectId,
  assertPdfFile,
  assertUploadSize,
  comicFieldsSchema,
  parseOrThrow,
  progressSchema,
} from "../common/validation";
import { CreateComicDto } from "./dto/create-comic.dto";
import { UpdateComicDto } from "./dto/update-comic.dto";
import { SaveProgressDto } from "./dto/save-progress.dto";

const PDF_FOLDER = "pdfs";
const COVER_FOLDER = "covers";

type ComicFiles = {
  pdfFile?: Express.Multer.File;
  coverImage?: Express.Multer.File;
};

@Injectable()
export class ComicsService {
  private readonly logger = new Logger(ComicsService.name);

  constructor(
    @InjectModel(Comic.name)
    private readonly comicModel: Model<Comic>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly s3: S3Service,
  ) {}

  private async removeTemp(file?: Express.Multer.File) {
    if (!file?.path) return;
    await fs.unlink(file.path).catch(() => undefined);
  }

  private async persistPdf(file: Express.Multer.File) {
    assertUploadSize(file, 100 * 1024 * 1024, "PDF");
    await assertPdfFile(file.path);
    try {
      const result = await this.s3.uploadPdf(
        file.path,
        PDF_FOLDER,
        file.originalname,
      );
      return { path: `s3://${result.key}`, key: result.key };
    } finally {
      await this.removeTemp(file);
    }
  }

  private async persistCover(file: Express.Multer.File) {
    try {
      assertUploadSize(file, 8 * 1024 * 1024, "Cover image");
      await assertImageFile(file.path);
      const result = await this.s3.uploadCover(
        file.path,
        COVER_FOLDER,
        file.mimetype,
        file.originalname || "cover.webp",
      );
      return { path: `s3://${result.key}`, key: result.key };
    } finally {
      await this.removeTemp(file);
    }
  }

  private async deleteStored(
    storedPath?: string | null,
    storedKey?: string | null,
  ) {
    if (!storedPath) return;
    if (storedPath.startsWith("s3://")) {
      const key = storedKey || storedPath.replace("s3://", "");
      if (key) await this.s3.deleteObject(key);
      return;
    }

    const relative = storedPath.startsWith("/")
      ? storedPath.slice(1)
      : storedPath;
    if (!relative.startsWith("uploads/")) return;
    const absolute = path.join(process.cwd(), "public", relative);
    await fs.unlink(absolute).catch(() => undefined);
  }

  private async signedCover(data: any): Promise<string | null> {
    if (!data.coverImage || typeof data.coverImage !== "string") return null;

    if (!data.coverImage.startsWith("s3://")) {
      return data.coverImage;
    }

    const key = data.coverPublicId || data.coverImage.replace("s3://", "");
    if (!key) return null;

    try {
      return await this.s3.getSignedUrl(key, 3600);
    } catch (error) {
      this.logger.warn(`Unable to create signed cover URL for ${key}`);
      return null;
    }
  }

  async toCard(comic: ComicDocument | any) {
    const data =
      typeof comic.toObject === "function" ? comic.toObject() : { ...comic };

    const coverImage = await this.signedCover(data);

    return {
      _id: data._id.toString(),
      title: data.title,
      author: data.author,
      year: data.year,
      category: data.category,
      coverImage,
      partNumber: data.partNumber ?? null,
      partName: data.partName ?? null,
    };
  }

  private async toReader(comic: ComicDocument) {
    const data: any = comic.toObject();

    const coverImage = await this.signedCover(data);

    let pdfFile: string | null = null;

    if (typeof data.pdfFile === "string") {
      if (data.pdfFile.startsWith("s3://")) {
        const key = data.pdfPublicId || data.pdfFile.replace("s3://", "");
        pdfFile = key ? await this.s3.getSignedPdfUrl(key, 7200) : null;
      } else {
        pdfFile = data.pdfFile;
      }
    }

    return {
      _id: data._id.toString(),
      title: data.title,
      author: data.author,
      year: data.year,
      category: data.category,
      pdfFile,
      coverImage,
      description: data.description || "",
      partNumber: data.partNumber ?? null,
      partName: data.partName ?? null,
    };
  }

  async findAll() {
    try {
      const comics = await this.comicModel
        .find()
        .sort({ year: 1, partNumber: 1, createdAt: 1, title: 1 });
      return {
        success: true,
        data: {
          comics: await Promise.all(comics.map((comic) => this.toCard(comic))),
        },
      };
    } catch (error) {
      this.logger.error("Error fetching comics", error);
      throw new HttpException(
        { success: false, error: "Failed to fetch comics" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findCategories() {
    const categories = await this.comicModel.distinct("category");
    return { success: true, data: { categories: categories.sort() } };
  }

  async findByCategory(category: string) {
    const normalized = category.trim().slice(0, 100);
    const comics = await this.comicModel
      .find({ category: normalized })
      .sort({ year: 1, partNumber: 1, createdAt: 1, title: 1 });
    return {
      success: true,
      data: {
        category: normalized,
        comics: await Promise.all(comics.map((comic) => this.toCard(comic))),
      },
    };
  }

  async findById(id: string, authUser: AuthUser) {
    assertObjectId(id, "comic id");
    const [comic, user] = await Promise.all([
      this.comicModel.findById(id),
      this.userModel.findById(authUser.id).select("readingProgress").lean(),
    ]);
    if (!comic) {
      throw new HttpException(
        { success: false, error: "Comic not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    const progressItem =
      user?.readingProgress?.find((item: any) => item.comicId === id) || null;

    const progress = progressItem
      ? {
          comicId: progressItem.comicId,
          page: progressItem.page,
          totalPages: progressItem.totalPages,
        }
      : null;
    return {
      success: true,
      data: { comic: await this.toReader(comic), progress },
    };
  }

  async saveProgress(
    comicId: string,
    dto: SaveProgressDto,
    authUser: AuthUser | undefined,
  ) {
    assertObjectId(comicId, "comic id");
    if (!authUser?.id) {
      throw new HttpException(
        { success: false, error: "Unauthorized" },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const values = parseOrThrow(progressSchema, dto ?? {});
    const comicExists = await this.comicModel.exists({ _id: comicId });
    if (!comicExists) {
      throw new HttpException(
        { success: false, error: "Comic not found" },
        HttpStatus.NOT_FOUND,
      );
    }

    if (values.totalPages && values.page > values.totalPages) {
      throw new HttpException(
        { success: false, error: "Page cannot be greater than total pages" },
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedAt = new Date();
    const totalPages = values.totalPages || 0;
    const existing = await this.userModel.updateOne(
      { _id: authUser.id, "readingProgress.comicId": comicId },
      {
        $set: {
          "readingProgress.$.page": values.page,
          "readingProgress.$.totalPages": totalPages,
          "readingProgress.$.updatedAt": updatedAt,
        },
      },
    );

    if (existing.matchedCount === 0) {
      const pushed = await this.userModel.updateOne(
        { _id: authUser.id },
        {
          $push: {
            readingProgress: {
              comicId,
              page: values.page,
              totalPages,
              updatedAt,
            },
          },
        },
      );
      if (pushed.matchedCount === 0) {
        throw new HttpException(
          { success: false, error: "User not found" },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    return {
      success: true,
      progress: {
        comicId,
        page: values.page,
        totalPages,
        updatedAt,
      },
    };
  }

  async resetProgress(comicId: string, authUser: AuthUser | undefined) {
    assertObjectId(comicId, "comic id");
    if (!authUser?.id) {
      throw new HttpException(
        { success: false, error: "Unauthorized" },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const comicExists = await this.comicModel.exists({ _id: comicId });
    if (!comicExists) {
      throw new HttpException(
        { success: false, error: "Comic not found" },
        HttpStatus.NOT_FOUND,
      );
    }

    const result = await this.userModel.updateOne(
      { _id: authUser.id },
      { $pull: { readingProgress: { comicId } } },
    );
    if (result.matchedCount === 0) {
      throw new HttpException(
        { success: false, error: "User not found" },
        HttpStatus.NOT_FOUND,
      );
    }

    return { success: true, data: { comicId, reset: true } };
  }

  private normalizeFields(
    dto: CreateComicDto | UpdateComicDto,
    requireAll: boolean,
  ) {
    const source: any = { ...dto };
    if (source.partNumber === "") source.partNumber = null;
    if (requireAll && source.partNumber === undefined) source.partNumber = null;
    if (source.partName === "") source.partName = null;

    if (requireAll) {
      return parseOrThrow(comicFieldsSchema, source);
    }

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
      const candidate = { ...defaults, [key]: source[key] };
      result[key] = (parseOrThrow(comicFieldsSchema, candidate) as any)[key];
    }
    return result;
  }

  async create(dto: CreateComicDto, files: ComicFiles = {}) {
    let pdfKey: string | null = null;
    let coverKey: string | null = null;
    try {
      const fields = this.normalizeFields(dto, true);
      if (!files.pdfFile) {
        throw new HttpException(
          { success: false, error: "A PDF file is required" },
          HttpStatus.BAD_REQUEST,
        );
      }

      const savedPdf = await this.persistPdf(files.pdfFile);
      pdfKey = savedPdf.key;
      const pdfFile = savedPdf.path;
      const pdfPublicId = savedPdf.key;
      let coverImage: string | null = null;
      let coverPublicId: string | null = null;

      if (files.coverImage) {
        const savedCover = await this.persistCover(files.coverImage);
        coverKey = savedCover.key;
        coverImage = savedCover.path;
        coverPublicId = savedCover.key;
      }

      const comic = await this.comicModel.create({
        ...fields,
        pdfFile,
        pdfPublicId,
        coverImage,
        coverPublicId,
      });
      pdfKey = null;
      coverKey = null;
      return { success: true, data: { comic: await this.toCard(comic) } };
    } catch (error) {
      await this.removeTemp(files.pdfFile);
      await this.removeTemp(files.coverImage);
      if (pdfKey) await this.s3.deleteObject(pdfKey);
      if (coverKey) await this.s3.deleteObject(coverKey);
      if (error instanceof HttpException) throw error;
      this.logger.error("Error creating comic", error);
      throw new HttpException(
        { success: false, error: "Failed to create comic" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, dto: UpdateComicDto, files: ComicFiles = {}) {
    assertObjectId(id, "comic id");
    let newPdfKey: string | null = null;
    let newCoverKey: string | null = null;
    try {
      const existing = await this.comicModel.findById(id);
      if (!existing) {
        throw new HttpException(
          { success: false, error: "Comic not found" },
          HttpStatus.NOT_FOUND,
        );
      }

      const update: any = this.normalizeFields(dto, false);

      if (files.pdfFile) {
        const saved = await this.persistPdf(files.pdfFile);
        newPdfKey = saved.key;
        update.pdfFile = saved.path;
        update.pdfPublicId = saved.key;
      }

      if (files.coverImage) {
        const saved = await this.persistCover(files.coverImage);
        newCoverKey = saved.key;
        update.coverImage = saved.path;
        update.coverPublicId = saved.key;
      }

      const updated = await this.comicModel.findByIdAndUpdate(id, update, {
        returnDocument: "after",
        runValidators: true,
      });
      if (!updated) throw new Error("Update failed");
      newPdfKey = null;
      newCoverKey = null;

      if (files.pdfFile && existing.pdfFile) {
        await this.deleteStored(existing.pdfFile, existing.pdfPublicId);
      }
      if (files.coverImage && existing.coverImage) {
        await this.deleteStored(existing.coverImage, existing.coverPublicId);
      }

      return { success: true, data: { comic: await this.toCard(updated) } };
    } catch (error) {
      await this.removeTemp(files.pdfFile);
      await this.removeTemp(files.coverImage);
      if (newPdfKey) await this.s3.deleteObject(newPdfKey);
      if (newCoverKey) await this.s3.deleteObject(newCoverKey);
      if (error instanceof HttpException) throw error;
      this.logger.error("Error updating comic", error);
      throw new HttpException(
        { success: false, error: "Failed to update comic" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateCover(id: string, file?: Express.Multer.File) {
    assertObjectId(id, "comic id");
    if (!file) {
      throw new HttpException(
        { success: false, error: "Cover image is required" },
        HttpStatus.BAD_REQUEST,
      );
    }
    const comic = await this.comicModel.findById(id);
    if (!comic) {
      await this.removeTemp(file);
      throw new HttpException(
        { success: false, error: "Comic not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    let key: string | null = null;
    try {
      const saved = await this.persistCover(file);
      key = saved.key;
      const oldPath = comic.coverImage;
      const oldKey = comic.coverPublicId;
      comic.coverImage = saved.path;
      comic.coverPublicId = saved.key;
      await comic.save();
      key = null;
      if (oldPath) await this.deleteStored(oldPath, oldKey);
      return { success: true, data: { comic: await this.toCard(comic) } };
    } catch (error) {
      await this.removeTemp(file);
      if (key) await this.s3.deleteObject(key);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: "Failed to update cover" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string) {
    assertObjectId(id, "comic id");
    const comic = await this.comicModel.findByIdAndDelete(id);
    if (!comic) {
      throw new HttpException(
        { success: false, error: "Comic not found" },
        HttpStatus.NOT_FOUND,
      );
    }

    await Promise.all([
      this.deleteStored(comic.pdfFile, comic.pdfPublicId),
      this.deleteStored(comic.coverImage, comic.coverPublicId),
      this.userModel.updateMany(
        {},
        {
          $pull: {
            library: comic._id,
            readingProgress: { comicId: comic._id.toString() },
          },
        },
      ),
    ]);

    return { success: true, data: { message: "Comic deleted successfully" } };
  }
}
