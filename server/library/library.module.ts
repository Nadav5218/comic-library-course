import { Module } from "@nestjs/common";
import { ComicsModule } from "../comics/comics.module";
import { UsersModule } from "../users/users.module";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";
@Module({
  imports: [UsersModule, ComicsModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
