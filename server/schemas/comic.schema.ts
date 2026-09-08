import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ComicDocument = HydratedDocument<Comic>;

@Schema({ timestamps: true, collection: "comics" })
export class Comic {
  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, required: true, trim: true })
  author: string;

  @Prop({ type: Number, required: true })
  year: number;

  @Prop({ type: String, required: true, trim: true, index: true })
  category: string;

  @Prop({ type: String, default: null })
  pdfFile?: string | null;

  @Prop({ type: String, default: null })
  pdfPublicId?: string | null;

  @Prop({ type: String, default: null })
  coverImage?: string | null;

  @Prop({ type: String, default: null })
  coverPublicId?: string | null;

  @Prop({ type: String, default: "" })
  description?: string;

  @Prop({ type: Number, default: null })
  partNumber?: number | null;

  @Prop({ type: String, default: null, trim: true })
  partName?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ComicSchema = SchemaFactory.createForClass(Comic);
ComicSchema.index({ title: "text", author: "text", category: "text" });
