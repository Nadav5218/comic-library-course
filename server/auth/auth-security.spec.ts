import { describe, expect, it, vi } from "vitest";
import { ExecutionContext, HttpException } from "@nestjs/common";
import bcrypt from "bcryptjs";

import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";

function createContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe("AuthService login", () => {
  it("logs in a valid user and returns only safe auth data", async () => {
    const passwordHash = await bcrypt.hash("Password123!", 4);

    const user = {
      _id: {
        toString: () => "507f1f77bcf86cd799439011",
      },
      username: "nadav",
      email: "nadav@example.com",
      passwordHash,
      role: "user",
    };

    const userModel = {
      findOne: vi.fn().mockResolvedValue(user),
    };

    const jwtService = {
      sign: vi.fn().mockReturnValue("signed-token"),
    };

    const service = new AuthService(userModel as any, jwtService as any);

    const result = await service.login({
      username: "NADAV",
      password: "Password123!",
    } as any);

    expect(userModel.findOne).toHaveBeenCalledWith({
      $or: [{ username: "nadav" }, { email: "nadav" }],
    });

    expect(jwtService.sign).toHaveBeenCalledWith({
      id: "507f1f77bcf86cd799439011",
      role: "user",
    });

    expect(result).toEqual({
      success: true,
      data: {
        token: "signed-token",
        user: {
          _id: user._id,
          username: "nadav",
          role: "user",
        },
      },
    });

    expect(result.data.user).not.toHaveProperty("passwordHash");
    expect(result.data.user).not.toHaveProperty("email");
  });

  it("rejects an incorrect password with 401", async () => {
    const passwordHash = await bcrypt.hash("CorrectPassword123!", 4);

    const userModel = {
      findOne: vi.fn().mockResolvedValue({
        _id: {
          toString: () => "507f1f77bcf86cd799439011",
        },
        username: "nadav",
        passwordHash,
        role: "user",
      }),
    };

    const jwtService = {
      sign: vi.fn(),
    };

    const service = new AuthService(userModel as any, jwtService as any);

    try {
      await service.login({
        username: "nadav",
        password: "WrongPassword123!",
      } as any);

      throw new Error("Expected login to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(401);
    }

    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});

describe("JwtAuthGuard", () => {
  it("rejects a request without a Bearer token", async () => {
    const guard = new JwtAuthGuard(
      { verify: vi.fn() } as any,
      {} as any,
    );

    const request = {
      headers: {},
    };

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects an invalid JWT", async () => {
    const jwtService = {
      verify: vi.fn().mockImplementation(() => {
        throw new Error("invalid token");
      }),
    };

    const guard = new JwtAuthGuard(jwtService as any, {} as any);

    const request = {
      headers: {
        authorization: "Bearer invalid-token",
      },
    };

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it("uses the current database role instead of trusting the JWT role", async () => {
    const jwtService = {
      verify: vi.fn().mockReturnValue({
        id: "507f1f77bcf86cd799439011",
        role: "admin",
      }),
    };

    const lean = vi.fn().mockResolvedValue({
      _id: {
        toString: () => "507f1f77bcf86cd799439011",
      },
      role: "user",
    });

    const select = vi.fn().mockReturnValue({ lean });

    const userModel = {
      findById: vi.fn().mockReturnValue({ select }),
    };

    const guard = new JwtAuthGuard(
      jwtService as any,
      userModel as any,
    );

    const request: any = {
      headers: {
        authorization: "Bearer valid-token",
      },
    };

    await expect(
      guard.canActivate(createContext(request)),
    ).resolves.toBe(true);

    expect(request.user).toEqual({
      id: "507f1f77bcf86cd799439011",
      role: "user",
    });
  });

  it("rejects a token for a user that no longer exists", async () => {
    const jwtService = {
      verify: vi.fn().mockReturnValue({
        id: "507f1f77bcf86cd799439011",
        role: "user",
      }),
    };

    const lean = vi.fn().mockResolvedValue(null);
    const select = vi.fn().mockReturnValue({ lean });

    const userModel = {
      findById: vi.fn().mockReturnValue({ select }),
    };

    const guard = new JwtAuthGuard(
      jwtService as any,
      userModel as any,
    );

    const request = {
      headers: {
        authorization: "Bearer valid-token",
      },
    };

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("AdminGuard", () => {
  it("allows an administrator", () => {
    const guard = new AdminGuard();

    const request = {
      headers: {},
      user: {
        id: "507f1f77bcf86cd799439011",
        role: "admin",
      },
    };

    expect(
      guard.canActivate(createContext(request)),
    ).toBe(true);
  });

  it("rejects a regular user with 403", () => {
    const guard = new AdminGuard();

    const request = {
      headers: {},
      user: {
        id: "507f1f77bcf86cd799439011",
        role: "user",
      },
    };

    expect(() =>
      guard.canActivate(createContext(request)),
    ).toThrow(HttpException);

    try {
      guard.canActivate(createContext(request));
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(403);
    }
  });
});

describe("AuthService register", () => {
  it("creates a regular user, normalizes fields and never exposes the password hash", async () => {
    const userModel = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (data: any) => ({
        _id: {
          toString: () => "507f1f77bcf86cd799439011",
        },
        ...data,
      })),
    };

    const jwtService = {
      sign: vi.fn().mockReturnValue("signed-token"),
    };

    const service = new AuthService(userModel as any, jwtService as any);

    const result = await service.register({
      username: "Nadav.Test",
      email: "NADAV@EXAMPLE.COM",
      phone: "050-1234567",
      password: "Password123!",
      role: "admin",
    } as any);

    expect(userModel.findOne).toHaveBeenCalledWith({
      $or: [
        { username: "nadav.test" },
        { email: "nadav@example.com" },
      ],
    });

    expect(userModel.create).toHaveBeenCalledOnce();

    const createdUser = userModel.create.mock.calls[0][0];

    expect(createdUser.username).toBe("nadav.test");
    expect(createdUser.email).toBe("nadav@example.com");
    expect(createdUser.role).toBe("user");
    expect(createdUser.passwordHash).not.toBe("Password123!");
    expect(
      await bcrypt.compare("Password123!", createdUser.passwordHash),
    ).toBe(true);

    expect(result.success).toBe(true);
    expect(result.data.token).toBe("signed-token");
    expect(result.data.user.role).toBe("user");
    expect(result.data.user).not.toHaveProperty("passwordHash");
    expect(result.data.user).not.toHaveProperty("email");
  });

  it("rejects a duplicate username or email with 409", async () => {
    const userModel = {
      findOne: vi.fn().mockResolvedValue({
        _id: "existing-user",
      }),
      create: vi.fn(),
    };

    const jwtService = {
      sign: vi.fn(),
    };

    const service = new AuthService(userModel as any, jwtService as any);

    try {
      await service.register({
        username: "nadav",
        email: "nadav@example.com",
        phone: "050-1234567",
        password: "Password123!",
      } as any);

      throw new Error("Expected registration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
    }

    expect(userModel.create).not.toHaveBeenCalled();
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
