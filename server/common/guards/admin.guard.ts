import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "../types";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!request.user || request.user.role !== "admin") {
      throw new HttpException(
        { success: false, error: "Forbidden" },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
