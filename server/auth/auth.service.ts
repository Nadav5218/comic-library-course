import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { Model } from "mongoose";
import bcrypt from "bcryptjs";
import { User, UserDocument } from "../schemas/user.schema";
import type { AuthUser } from "../common/types";
import {
  assertObjectId,
  loginSchema,
  parseOrThrow,
  registerSchema,
} from "../common/validation";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

const DUMMY_PASSWORD_HASH =
  "$2a$12$2BzPGiVnpfVTOqxXa1/QFOT/DfKB2IkT8OQansEkVHw8NzJbr.7dq";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
  ) {}

  private signToken(payload: AuthUser): string {
    return this.jwtService.sign(payload);
  }

private toAuthUser(user: UserDocument | any) {
  return {
    _id: user._id,
    username: user.username,
    role: user.role,
  };
}

 private toPublicUser(user: UserDocument | any) {
  return {
    _id: user._id,
    username: user.username,
    role: user.role,
    library: user.library,
    readingProgress: (user.readingProgress || []).map((item: any) => ({
    comicId: item.comicId,
    page: item.page,
    totalPages: item.totalPages,
   })),
  };
}

  async register(dto: RegisterDto) {
    try {
      const parsed = parseOrThrow(registerSchema, dto ?? {});
      const normalizedUsername = parsed.username.toLowerCase();
      const normalizedEmail = parsed.email.toLowerCase();
      const existingUser = await this.userModel.findOne({
        $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
      });

      if (existingUser) {
        throw new HttpException(
          { success: false, error: "Username or email already registered" },
          HttpStatus.CONFLICT,
        );
      }

      const passwordHash = await bcrypt.hash(parsed.password, 12);
      const user = await this.userModel.create({
        username: normalizedUsername,
        email: normalizedEmail,
        phone: parsed.phone,
        passwordHash,
        role: "user",
        readingProgress: [],
        library: [],
        notifications: [],
      });

     const token = this.signToken({
  id: user._id.toString(),
  role: user.role,
});

      return {
        success: true,
        data: { token, user: this.toAuthUser(user) },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error?.code === 11000) {
        throw new HttpException(
          { success: false, error: "Username or email already registered" },
          HttpStatus.CONFLICT,
        );
      }
      throw new HttpException(
        { success: false, error: "Failed to register" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async login(dto: LoginDto) {
    try {
      const parsed = parseOrThrow(loginSchema, dto ?? {});
      const identifier = (parsed.username || parsed.email || "")
        .toLowerCase()
        .trim();
      const user = await this.userModel.findOne({
        $or: [{ username: identifier }, { email: identifier }],
      });

      const passwordMatches = await bcrypt.compare(
        parsed.password,
        user?.passwordHash || DUMMY_PASSWORD_HASH,
      );

      if (!user || !passwordMatches) {
        throw new HttpException(
          { success: false, error: "Invalid credentials" },
          HttpStatus.UNAUTHORIZED,
        );
      }

     const token = this.signToken({
  id: user._id.toString(),
  role: user.role,
});

      return {
        success: true,
        data: { token, user: this.toAuthUser(user) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: "Failed to login" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async me(authUser: AuthUser | undefined) {
    if (!authUser?.id) {
      throw new HttpException(
        { success: false, error: "Unauthorized" },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const user = await this.userModel.findById(authUser.id);
    if (!user) {
      throw new HttpException(
        { success: false, error: "User not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true, user: this.toPublicUser(user) };
  }

  async notifications(authUser: AuthUser) {
    const user = await this.userModel
      .findById(authUser.id)
      .select("notifications")
      .lean();
    if (!user) {
      throw new HttpException(
        { success: false, error: "User not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    const notifications = [...(user.notifications || [])]
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 50);
    return {
      success: true,
      data: {
        notifications,
        unread: notifications.filter((item: any) => !item.read).length,
      },
    };
  }

  async markAllNotificationsRead(authUser: AuthUser) {
    await this.userModel.updateOne(
      { _id: authUser.id },
      { $set: { "notifications.$[].read": true } },
    );
    return { success: true };
  }

  async markNotificationRead(authUser: AuthUser, notificationId: string) {
    assertObjectId(notificationId, "notification id");
    await this.userModel.updateOne(
      { _id: authUser.id, "notifications._id": notificationId },
      { $set: { "notifications.$.read": true } },
    );
    return { success: true };
  }
}
