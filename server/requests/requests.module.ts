import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  ComicRequest,
  ComicRequestSchema,
} from "../schemas/comic-request.schema";
import { ComicsModule } from "../comics/comics.module";
import { UsersModule } from "../users/users.module";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ComicRequest.name, schema: ComicRequestSchema },
    ]),
    ComicsModule,
    UsersModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
