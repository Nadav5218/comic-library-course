import { describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";

import { ComicsService } from "./comics.service";

const USER_ID = "507f1f77bcf86cd799439011";
const COMIC_ID = "507f191e810c19729de860ea";

describe("ComicsService reading progress", () => {
  it("rejects progress updates from unauthenticated users", async () => {
    const service = new ComicsService(
      {} as any,
      {} as any,
      {} as any,
    );

    try {
      await service.saveProgress(
        COMIC_ID,
        { page: 2, totalPages: 10 },
        undefined,
      );

      throw new Error("Expected saveProgress to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(401);
    }
  });

  it("rejects progress for a comic that does not exist", async () => {
    const comicModel = {
      exists: vi.fn().mockResolvedValue(null),
    };

    const service = new ComicsService(
      comicModel as any,
      {} as any,
      {} as any,
    );

    try {
      await service.saveProgress(
        COMIC_ID,
        { page: 2, totalPages: 10 },
        { id: USER_ID, role: "user" },
      );

      throw new Error("Expected saveProgress to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
    }
  });

  it("rejects a page greater than the total page count", async () => {
    const comicModel = {
      exists: vi.fn().mockResolvedValue({ _id: COMIC_ID }),
    };

    const userModel = {
      updateOne: vi.fn(),
    };

    const service = new ComicsService(
      comicModel as any,
      userModel as any,
      {} as any,
    );

    try {
      await service.saveProgress(
        COMIC_ID,
        { page: 11, totalPages: 10 },
        { id: USER_ID, role: "user" },
      );

      throw new Error("Expected saveProgress to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
    }

    expect(userModel.updateOne).not.toHaveBeenCalled();
  });

  it("updates existing reading progress for the authenticated user", async () => {
    const comicModel = {
      exists: vi.fn().mockResolvedValue({ _id: COMIC_ID }),
    };

    const userModel = {
      updateOne: vi.fn().mockResolvedValue({
        matchedCount: 1,
      }),
    };

    const service = new ComicsService(
      comicModel as any,
      userModel as any,
      {} as any,
    );

    const result = await service.saveProgress(
      COMIC_ID,
      { page: 4, totalPages: 20 },
      { id: USER_ID, role: "user" },
    );

    expect(userModel.updateOne).toHaveBeenCalledWith(
      {
        _id: USER_ID,
        "readingProgress.comicId": COMIC_ID,
      },
      {
        $set: {
          "readingProgress.$.page": 4,
          "readingProgress.$.totalPages": 20,
          "readingProgress.$.updatedAt": expect.any(Date),
        },
      },
    );

    expect(result.success).toBe(true);
    expect(result.progress.comicId).toBe(COMIC_ID);
    expect(result.progress.page).toBe(4);
    expect(result.progress.totalPages).toBe(20);
  });

  it("creates progress when no existing progress entry is found", async () => {
    const comicModel = {
      exists: vi.fn().mockResolvedValue({ _id: COMIC_ID }),
    };

    const userModel = {
      updateOne: vi
        .fn()
        .mockResolvedValueOnce({ matchedCount: 0 })
        .mockResolvedValueOnce({ matchedCount: 1 }),
    };

    const service = new ComicsService(
      comicModel as any,
      userModel as any,
      {} as any,
    );

    await service.saveProgress(
      COMIC_ID,
      { page: 1, totalPages: 15 },
      { id: USER_ID, role: "user" },
    );

    expect(userModel.updateOne).toHaveBeenCalledTimes(2);

    expect(userModel.updateOne).toHaveBeenNthCalledWith(
      2,
      { _id: USER_ID },
      {
        $push: {
          readingProgress: {
            comicId: COMIC_ID,
            page: 1,
            totalPages: 15,
            updatedAt: expect.any(Date),
          },
        },
      },
    );
  });

  it("resets reading progress for the authenticated user", async () => {
    const comicModel = {
      exists: vi.fn().mockResolvedValue({ _id: COMIC_ID }),
    };

    const userModel = {
      updateOne: vi.fn().mockResolvedValue({
        matchedCount: 1,
      }),
    };

    const service = new ComicsService(
      comicModel as any,
      userModel as any,
      {} as any,
    );

    const result = await service.resetProgress(
      COMIC_ID,
      { id: USER_ID, role: "user" },
    );

    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      {
        $pull: {
          readingProgress: {
            comicId: COMIC_ID,
          },
        },
      },
    );

    expect(result).toEqual({
      success: true,
      data: {
        comicId: COMIC_ID,
        reset: true,
      },
    });
  });
});
