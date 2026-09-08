import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import type { ComicRequestStatus } from "@shared/api";
export type ComicRequestDocument = HydratedDocument<ComicRequest>;
@Schema({ timestamps: true, collection: "comicrequests" })
export class ComicRequest {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  requestedBy: mongoose.Types.ObjectId;
  @Prop({ type: String, default: "", trim: true })
  requesterUsername: string;
  @Prop({ type: String, required: true, trim: true })
  requesterEmail: string;
  @Prop({ type: String, default: "", trim: true })
  requesterPhone: string;
  @Prop({ type: String, required: true, trim: true })
  title: string;
  @Prop({ type: String, required: true, trim: true })
  author: string;
  @Prop({ type: Number, required: true })
  year: number;
  @Prop({ type: String, required: true, trim: true })
  category: string;
  @Prop({ type: String, default: "" })
  description?: string;
  @Prop({ type: Number, default: null })
  partNumber?: number | null;
  @Prop({ type: String, default: null, trim: true })
  partName?: string | null;
  @Prop({ type: String, default: null })
  pdfFile?: string | null;
  @Prop({ type: String, default: null })
  pdfPublicId?: string | null;
  @Prop({ type: String, default: null })
  coverImage?: string | null;
  @Prop({ type: String, default: null })
  coverPublicId?: string | null;
  @Prop({ type: String, default: "" })
  originalFileName?: string;
  @Prop({
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    required: true,
    index: true,
  })
  status: ComicRequestStatus;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: "User", default: null })
  reviewedBy?: mongoose.Types.ObjectId | null;
  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: "Comic", default: null })
  approvedComicId?: mongoose.Types.ObjectId | null;
  @Prop({ type: String, default: null, trim: true, maxlength: 1200 })
  adminNote?: string | null;
  @Prop({ type: String, default: null })
  reviewLock?: string | null;
  @Prop({ type: Date, default: null })
  reviewLockExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export const ComicRequestSchema = SchemaFactory.createForClass(ComicRequest);
