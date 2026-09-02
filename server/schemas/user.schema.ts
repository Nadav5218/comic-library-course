import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import type { UserRole } from "@shared/api";

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class ReadingProgress {
  @Prop({ type: String, required: true })
  comicId: string;

  @Prop({ type: Number, required: true })
  page: number;

  @Prop({ type: Number })
  totalPages?: number;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const ReadingProgressSchema =
  SchemaFactory.createForClass(ReadingProgress);

@Schema({ timestamps: true })
export class UserNotification {
  _id: mongoose.Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, required: true, trim: true })
  message: string;

  @Prop({ type: String, default: "info" })
  type: string;

  @Prop({ type: String, default: null })
  link?: string | null;

  @Prop({ type: Boolean, default: false })
  read: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const UserNotificationSchema =
  SchemaFactory.createForClass(UserNotification);

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  })
  username: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ type: String, required: true, trim: true })
  phone: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({
    type: String,
    enum: ["admin", "user"],
    default: "user",
    required: true,
  })
  role: UserRole;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comic" }],
    default: [],
  })
  library: mongoose.Types.ObjectId[];

  @Prop({ type: [ReadingProgressSchema], default: [] })
  readingProgress: ReadingProgress[];

  @Prop({ type: [UserNotificationSchema], default: [] })
  notifications: UserNotification[];

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
