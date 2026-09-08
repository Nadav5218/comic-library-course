import { describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";

import { LibraryService } from "./library.service";

const USER_ID = "507f1f77bcf86cd799439011";
const COMIC_ID = "507f191e810c19729de860ea";

describe("LibraryService", () => {
  it("adds an existing comic to the authenticated user's library", async () => {
    const userModel = {
      findByIdAndUpdate: vi.fn().mockResolvedValue({
        _id: USER_ID,
        library: [COMIC_ID],
      }),
    };

    const comicModel = {
      exists: vi.fn().mockResolvedValue({ _id: COMIC_ID }),
    };

    const service = new LibraryService(
      userModel as any,
      comicModel as any,
      {} as any,
    );

    const result = await service.addToLibrary(
      { id: USER_ID, role: "user" },
      COMIC_ID,
    );

    expect(comicModel.exists).toHaveBeenCalledWith({
      _id: COMIC_ID,
    });

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { $addToSet: { library: COMIC_ID } },
      { returnDocument: "after" },
    );

    expect(result).toEqual({
      success: true,
      data: { comicId: COMIC_ID },
    });
  });

  it("rejects adding a comic that does not exist", async () => {
    const userModel = {
      findByIdAndUpdate: vi.fn(),
    };

    const comicModel = {
      exists: vi.fn().mockResolvedValue(null),
    };

    const service = new LibraryService(
      userModel as any,
      comicModel as any,
      {} as any,
    );

    try {
      await service.addToLibrary(
        { id: USER_ID, role: "user" },
        COMIC_ID,
      );

      throw new Error("Expected addToLibrary to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
    }

    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("removes a comic only from the authenticated user's library", async () => {
    const userModel = {
      findByIdAndUpdate: vi.fn().mockResolvedValue({
        _id: USER_ID,
        library: [],
      }),
    };

    const service = new LibraryService(
      userModel as any,
      {} as any,
      {} as any,
    );

    const result = await service.removeFromLibrary(
      { id: USER_ID, role: "user" },
      COMIC_ID,
    );

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { $pull: { library: COMIC_ID } },
      { returnDocument: "after" },
    );

    expect(result).toEqual({
      success: true,
      data: { comicId: COMIC_ID },
    });
  });

  it("returns 404 when the authenticated user no longer exists", async () => {
    const userModel = {
      findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    };

    const service = new LibraryService(
      userModel as any,
      {} as any,
      {} as any,
    );

    try {
      await service.removeFromLibrary(
        { id: USER_ID, role: "user" },
        COMIC_ID,
      );

      throw new Error("Expected removeFromLibrary to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
    }
  });
});
