import { Global, Logger, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "../users/users.module";
import { AdminGuard } from "./guards/admin.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

const logger = new Logger("SecurityModule");

@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET?.trim();
        const production = process.env.NODE_ENV === "production";

        if (production && (!secret || secret.length < 48)) {
          throw new Error(
            "JWT_SECRET must be set to at least 48 characters when NODE_ENV=production",
          );
        }

        if (!secret) {
          logger.warn(
            "JWT_SECRET is not set. A development-only secret will be used.",
          );
        }

        return {
          secret: secret || "dev-only-insecure-secret-change-me",
          signOptions: {
            expiresIn: "8h",
            issuer: "comic-library",
            audience: "comic-library-web",
          },
          verifyOptions: {
            issuer: "comic-library",
            audience: "comic-library-web",
          },
        };
      },
    }),
  ],
  providers: [JwtAuthGuard, AdminGuard],
  exports: [JwtModule, JwtAuthGuard, AdminGuard],
})
export class SecurityModule {}
