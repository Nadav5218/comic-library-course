import { describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import { ComicsService } from "./comics.service";

const COMIC_ID = "507f191e810c19729de860ea";

const validComicDto = {
  title: "Test Comic",
  author: "Test Author",
  year: 2025,
  category: "Testing",
  description: "Test description",
  partNumber: 1,
  partName: "Main Story",
};

describe("ComicsService CRUD", () => {
  it("rejects comic creation when no PDF is provided", async () => {
    const service = new ComicsService(
      {} as any,
      {} as any,
      {} as any,
    );

    try {
      await service.create(validComicDto as any);

      throw new Error("Expected comic creation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
    }
  });

  it("creates a comic with a valid PDF", async () => {
    const folder = await mkdtemp(
      path.join(tmpdir(), "comic-library-test-"),
    );
    const filePath = path.join(folder, "valid.pdf");
    const contents = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF",
    );

    await writeFile(filePath, contents);

    const comicModel = {
      create: vi.fn().mockImplementation(async (data: any) => ({
        _id: COMIC_ID,
        ...data,
      })),
    };

    const s3 = {
      uploadPdf: vi.fn().mockResolvedValue({
        key: "pdfs/test-comic.pdf",
      }),
      deleteObject: vi.fn(),
      getSignedUrl: vi.fn(),
    };

    const service = new ComicsService(
      comicModel as any,
      {} as any,
      s3 as any,
    );

    const result = await service.create(
      validComicDto as any,
      {
        pdfFile: {
          path: filePath,
          originalname: "valid.pdf",
          mimetype: "application/pdf",
          size: contents.length,
        } as any,
      },
    );

    expect(s3.uploadPdf).toHaveBeenCalledWith(
      filePath,
      "pdfs",
      "valid.pdf",
    );

    expect(comicModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Comic",
        author: "Test Author",
        pdfFile: "s3://pdfs/test-comic.pdf",
        pdfPublicId: "pdfs/test-comic.pdf",
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data.comic._id).toBe(COMIC_ID);
    expect(result.data.comic.title).toBe("Test Comic");
  });

  it("rejects an uploaded file whose content is not a real PDF", async () => {
    const folder = await mkdtemp(
      path.join(tmpdir(), "comic-library-invalid-"),
    );
    const filePath = path.join(folder, "fake.pdf");
    const contents = Buffer.from(
      "This file has a PDF extension but is not a PDF.",
    );

    await writeFile(filePath, contents);

    const comicModel = {
      create: vi.fn(),
    };

    const s3 = {
      uploadPdf: vi.fn(),
      deleteObject: vi.fn(),
    };

    const service = new ComicsService(
      comicModel as any,
      {} as any,
      s3 as any,
    );

    try {
      await service.create(
        validComicDto as any,
        {
          pdfFile: {
            path: filePath,
            originalname: "fake.pdf",
            mimetype: "application/pdf",
            size: contents.length,
          } as any,
        },
      );

      throw new Error("Expected invalid PDF upload to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
    }

    expect(s3.uploadPdf).not.toHaveBeenCalled();
    expect(comicModel.create).not.toHaveBeenCalled();
  });

  it("updates comic metadata", async () => {
    const existingComic = {
      _id: COMIC_ID,
      title: "Old Title",
      author: "Test Author",
      year: 2025,
      category: "Testing",
      description: "",
      partNumber: 1,
      partName: "Main Story",
      pdfFile: null,
      coverImage: null,
    };

    const updatedComic = {
      ...existingComic,
      title: "Updated Title",
    };

    const comicModel = {
      findById: vi.fn().mockResolvedValue(existingComic),
      findByIdAndUpdate: vi.fn().mockResolvedValue(updatedComic),
    };

    const service = new ComicsService(
      comicModel as any,
      {} as any,
      {} as any,
    );

    const result = await service.update(
      COMIC_ID,
      { title: "Updated Title" } as any,
    );

    expect(comicModel.findByIdAndUpdate).toHaveBeenCalledWith(
      COMIC_ID,
      { title: "Updated Title" },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.comic.title).toBe("Updated Title");
  });

  it("returns 404 when updating a comic that does not exist", async () => {
    const comicModel = {
      findById: vi.fn().mockResolvedValue(null),
    };

    const service = new ComicsService(
      comicModel as any,
      {} as any,
      {} as any,
    );

    try {
      await service.update(
        COMIC_ID,
        { title: "Updated Title" } as any,
      );

      throw new Error("Expected update to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
    }
  });

  it("deletes a comic and removes user library/progress references", async () => {
    const comic = {
      _id: {
        toString: () => COMIC_ID,
      },
      pdfFile: null,
      pdfPublicId: null,
      coverImage: null,
      coverPublicId: null,
    };

    const comicModel = {
      findByIdAndDelete: vi.fn().mockResolvedValue(comic),
    };

    const userModel = {
      updateMany: vi.fn().mockResolvedValue({
        acknowledged: true,
      }),
    };

    const service = new ComicsService(
      comicModel as any,
      userModel as any,
      {} as any,
    );

    const result = await service.remove(COMIC_ID);

    expect(comicModel.findByIdAndDelete).toHaveBeenCalledWith(
      COMIC_ID,
    );

    expect(userModel.updateMany).toHaveBeenCalledWith(
      {},
      {
        $pull: {
          library: comic._id,
          readingProgress: {
            comicId: COMIC_ID,
          },
        },
      },
    );

    expect(result).toEqual({
      success: true,
      data: {
        message: "Comic deleted successfully",
      },
    });
  });
});
