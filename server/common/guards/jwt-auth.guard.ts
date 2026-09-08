import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { Model } from "mongoose";
import { User } from "../../schemas/user.schema";
import type { AuthUser } from "../types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new HttpException(
        { success: false, error: "Unauthorized" },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = header.slice(7).trim();

    try {
      const payload = this.jwtService.verify<AuthUser>(token);
      const dbUser = await this.userModel
  .findById(payload.id)
  .select("role")
  .lean();

      if (!dbUser) {
        throw new Error("User no longer exists");
      }

      request.user = {
  id: dbUser._id.toString(),
  role: dbUser.role,
};
      return true;
    } catch {
      throw new HttpException(
        { success: false, error: "Invalid or expired session" },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
