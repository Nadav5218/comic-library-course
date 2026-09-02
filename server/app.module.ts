import { Logger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { AppController } from "./app.controller";
import { S3Module } from "./s3/s3.module";
import { SecurityModule } from "./common/security.module";
import { MailModule } from "./mail/mail.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { ComicsModule } from "./comics/comics.module";
import { LibraryModule } from "./library/library.module";
import { RequestsModule } from "./requests/requests.module";
import { AdminModule } from "./admin/admin.module";

const logger = new Logger("AppModule");

mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

function hasCredentials(uri: string): boolean {
  return /:\/\/[^\/@]+:[^\/@]+@/.test(uri);
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      useFactory: () => {
        const uri =
          process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/comic_library";

        if (!hasCredentials(uri)) {
          if (process.env.NODE_ENV === "production") {
            throw new Error(
              "MONGODB_URI has no username/password and NODE_ENV=production. Refusing to start: an " +
                "unauthenticated MongoDB lets anyone with network/shell access read or modify all data, " +
                "including granting themselves the admin role. Enable MongoDB authentication and use a " +
                "URI like mongodb://<user>:<password>@<host>:27017/<db> (see .env.example).",
            );
          }

          logger.warn(
            "MONGODB_URI has no username/password — MongoDB authentication is OFF. This must only be " +
              "used for local development; see .env.example / README before deploying.",
          );
        }

        return { uri };
      },
    }),

    SecurityModule,
    MailModule,
    UsersModule,
    AuthModule,
    S3Module,
    ComicsModule,
    LibraryModule,
    RequestsModule,
    AdminModule,
  ],

  controllers: [AppController],
})
export class AppModule {}
