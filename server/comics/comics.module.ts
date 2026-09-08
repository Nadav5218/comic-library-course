import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Comic, ComicSchema } from "../schemas/comic.schema";
import { UsersModule } from "../users/users.module";
import { ComicsController } from "./comics.controller";
import { ComicsService } from "./comics.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comic.name, schema: ComicSchema }]),
    UsersModule,
  ],
  controllers: [ComicsController],
  providers: [ComicsService],
  exports: [MongooseModule, ComicsService],
})
export class ComicsModule {}
