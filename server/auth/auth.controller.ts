import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  @Get("notifications")
  @UseGuards(JwtAuthGuard)
  notifications(@CurrentUser() user: AuthUser) {
    return this.authService.notifications(user);
  }

  @Post("notifications/read-all")
  @UseGuards(JwtAuthGuard)
  markAllNotificationsRead(@CurrentUser() user: AuthUser) {
    return this.authService.markAllNotificationsRead(user);
  }

  @Post("notifications/:id/read")
  @UseGuards(JwtAuthGuard)
  markNotificationRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.authService.markNotificationRead(user, id);
  }
}
