import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Comic, ComicSchema } from "../schemas/comic.schema";
import {
  ComicRequest,
  ComicRequestSchema,
} from "../schemas/comic-request.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comic.name, schema: ComicSchema },
      { name: User.name, schema: UserSchema },
      { name: ComicRequest.name, schema: ComicRequestSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
