import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types";
import { GroupUpdateDto } from "./dto/group-update.dto";
import { LibraryService } from "./library.service";
@Controller("api/library")
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}
  @Get()
  getLibrary(
    @CurrentUser()
    user: AuthUser,
    @Query("search")
    search?: string,
  ) {
    return this.libraryService.getLibrary(user, search);
  }
  @Post("group")
  @HttpCode(HttpStatus.OK)
  groupUpdate(
    @CurrentUser()
    user: AuthUser,
    @Body()
    dto: GroupUpdateDto,
  ) {
    return this.libraryService.groupUpdate(user, dto);
  }
  @Post(":comicId")
  @HttpCode(HttpStatus.OK)
  addToLibrary(
    @CurrentUser()
    user: AuthUser,
    @Param("comicId")
    comicId: string,
  ) {
    return this.libraryService.addToLibrary(user, comicId);
  }
  @Delete(":comicId")
  removeFromLibrary(
    @CurrentUser()
    user: AuthUser,
    @Param("comicId")
    comicId: string,
  ) {
    return this.libraryService.removeFromLibrary(user, comicId);
  }
}
