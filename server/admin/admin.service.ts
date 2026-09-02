import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Comic } from "../schemas/comic.schema";
import { ComicRequest } from "../schemas/comic-request.schema";
import { User } from "../schemas/user.schema";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Comic.name)
    private readonly comicModel: Model<Comic>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(ComicRequest.name)
    private readonly requestModel: Model<ComicRequest>,
  ) {}

  async stats() {
    const [totalComics, totalUsers, pendingRequests, totalRequests, recent] =
      await Promise.all([
        this.comicModel.countDocuments(),
        this.userModel.countDocuments(),
        this.requestModel.countDocuments({ status: "pending" }),
        this.requestModel.countDocuments(),
        this.comicModel
          .find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select("title category createdAt")
          .lean(),
      ]);

    return {
      success: true,
      data: {
        totalComics,
        totalUsers,
        pendingRequests,
        totalRequests,
        recentUploads: recent.map((comic) => ({
          _id: comic._id.toString(),
          title: comic.title,
          category: comic.category,
          createdAt: comic.createdAt,
        })),
      },
    };
  }
}
