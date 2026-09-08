import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Comic } from "../schemas/comic.schema";
import { User } from "../schemas/user.schema";
import type { AuthUser } from "../common/types";
import { ComicsService } from "../comics/comics.service";
import {
  assertObjectId,
  groupUpdateSchema,
  parseOrThrow,
} from "../common/validation";
import { GroupUpdateDto } from "./dto/group-update.dto";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

@Injectable()
export class LibraryService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Comic.name)
    private readonly comicModel: Model<Comic>,
    private readonly comicsService: ComicsService,
  ) {}

  async getLibrary(authUser: AuthUser, search?: string) {
    try {
      const term = (search || "").trim().slice(0, 120);
      const safeTerm = escapeRegex(term);
      const user = await this.userModel.findById(authUser.id).populate({
        path: "library",
        match: safeTerm
          ? {
              $or: [
                { title: { $regex: safeTerm, $options: "i" } },
                { author: { $regex: safeTerm, $options: "i" } },
                { category: { $regex: safeTerm, $options: "i" } },
              ],
            }
          : {},
        options: { sort: { year: -1, title: 1, createdAt: -1 } },
      });
      if (!user) {
        throw new HttpException(
          { success: false, error: "User not found" },
          HttpStatus.NOT_FOUND,
        );
      }
      const library = (user.library as any[]) || [];
      const comics = await Promise.all(
        library.map((comic) => this.comicsService.toCard(comic)),
      );
      return { success: true, data: { comics } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: "Failed to fetch library" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async groupUpdate(authUser: AuthUser, dto: GroupUpdateDto) {
    const values = parseOrThrow(groupUpdateSchema, dto ?? {});
    const requestedPart = values.partName?.trim() || "Main Story";
    const allComics = await this.comicModel.find({ category: values.category });
    const target = allComics.filter(
      (comic) => (comic.partName?.trim() || "Main Story") === requestedPart,
    );
    if (!target.length) {
      throw new HttpException(
        { success: false, error: "No comics found matching this group" },
        HttpStatus.NOT_FOUND,
      );
    }
    const ids = target.map((comic) => comic._id);
    const update =
      values.action === "add"
        ? { $addToSet: { library: { $each: ids as any } } }
        : { $pullAll: { library: ids as any } };
    await this.userModel.findByIdAndUpdate(authUser.id, update);
    return { success: true, data: { comicIds: ids.map(String) } };
  }

  async addToLibrary(authUser: AuthUser, comicId: string) {
    assertObjectId(comicId, "comic id");
    const exists = await this.comicModel.exists({ _id: comicId });
    if (!exists) {
      throw new HttpException(
        { success: false, error: "Comic not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    const user = await this.userModel.findByIdAndUpdate(
      authUser.id,
      { $addToSet: { library: comicId } },
      { returnDocument: "after" },
    );
    if (!user) {
      throw new HttpException(
        { success: false, error: "User not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true, data: { comicId } };
  }

  async removeFromLibrary(authUser: AuthUser, comicId: string) {
    assertObjectId(comicId, "comic id");
    const user = await this.userModel.findByIdAndUpdate(
      authUser.id,
      { $pull: { library: comicId } },
      { returnDocument: "after" },
    );
    if (!user) {
      throw new HttpException(
        { success: false, error: "User not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true, data: { comicId } };
  }
}
