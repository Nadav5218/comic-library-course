import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from "@nestjs/platform-express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminGuard } from "../common/guards/admin.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types";
import { ComicsService } from "./comics.service";
import { comicUploadOptions } from "./comics.upload";
import { CreateComicDto } from "./dto/create-comic.dto";
import { SaveProgressDto } from "./dto/save-progress.dto";
import { UpdateComicDto } from "./dto/update-comic.dto";

type UploadedComicFiles = {
  pdfFile?: Express.Multer.File[];
  coverImage?: Express.Multer.File[];
};

@Controller("api/comics")
export class ComicsController {
  constructor(private readonly comicsService: ComicsService) {}

  @Get()
  findAll() {
    return this.comicsService.findAll();
  }

  @Get("categories")
  findCategories() {
    return this.comicsService.findCategories();
  }

  @Get("category/:category")
  findByCategory(@Param("category") category: string) {
    return this.comicsService.findByCategory(category);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findById(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.comicsService.findById(id, user);
  }

  @Post(":id/progress")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  saveProgress(
    @Param("id") id: string,
    @Body() dto: SaveProgressDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comicsService.saveProgress(id, dto, user);
  }

  @Delete(":id/progress")
  @UseGuards(JwtAuthGuard)
  resetProgress(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.comicsService.resetProgress(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "pdfFile", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
      ],
      comicUploadOptions,
    ),
  )
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateComicDto,
    @UploadedFiles() files?: UploadedComicFiles,
  ) {
    return this.comicsService.create(dto, {
      pdfFile: files?.pdfFile?.[0],
      coverImage: files?.coverImage?.[0],
    });
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "pdfFile", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
      ],
      comicUploadOptions,
    ),
  )
  update(
    @Param("id") id: string,
    @Body() dto: UpdateComicDto,
    @UploadedFiles() files?: UploadedComicFiles,
  ) {
    return this.comicsService.update(id, dto, {
      pdfFile: files?.pdfFile?.[0],
      coverImage: files?.coverImage?.[0],
    });
  }

  @Post(":id/cover")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor("coverImage", comicUploadOptions))
  updateCover(
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.comicsService.updateCover(id, file);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param("id") id: string) {
    return this.comicsService.remove(id);
  }
}
