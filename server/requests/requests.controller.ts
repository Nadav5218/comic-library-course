import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminGuard } from "../common/guards/admin.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types";
import { CreateRequestDto } from "./dto/create-request.dto";
import { ReviewRequestDto } from "./dto/review-request.dto";
import { RequestsService } from "./requests.service";
import { requestUploadOptions } from "./requests.upload";

type UploadedRequestFiles = {
  pdfFile?: Express.Multer.File[];
  coverImage?: Express.Multer.File[];
};

@Controller("api/requests")
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "pdfFile", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
      ],
      requestUploadOptions,
    ),
  )
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files?: UploadedRequestFiles,
  ) {
    return this.requestsService.create(
      dto,
      {
        pdfFile: files?.pdfFile?.[0],
        coverImage: files?.coverImage?.[0],
      },
      user,
    );
  }

  @Get("mine")
  findMine(@CurrentUser() user: AuthUser) {
    return this.requestsService.findMine(user);
  }

  @Get("count")
  @UseGuards(AdminGuard)
  countPending() {
    return this.requestsService.countPending();
  }

  @Get()
  @UseGuards(AdminGuard)
  findAll(@Query("status") status?: string) {
    return this.requestsService.findAll(status);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.requestsService.findOne(id, user);
  }

  @Put(":id")
  @UseGuards(AdminGuard)
  update(@Param("id") id: string, @Body() dto: ReviewRequestDto) {
    return this.requestsService.update(id, dto);
  }

  @Post(":id/approve")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  approve(
    @Param("id") id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.approve(id, dto, user);
  }

  @Post(":id/reject")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  reject(
    @Param("id") id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.reject(id, dto, user);
  }
}
