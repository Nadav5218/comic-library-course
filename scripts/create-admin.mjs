import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import "dotenv/config";

const config = z
  .object({
    MONGODB_URI: z.string().min(1),
    ADMIN_USERNAME: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[\p{L}\p{N}._-]+$/u),
    ADMIN_EMAIL: z.string().trim().toLowerCase().email().max(160),
    ADMIN_PHONE: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .regex(/^[+\d][\d\s().-]*$/),
    ADMIN_PASSWORD: z.string().min(12).max(128),
  })
  .parse(process.env);

await mongoose.connect(config.MONGODB_URI);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    library: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    readingProgress: { type: Array, default: [] },
    notifications: { type: Array, default: [] },
  },
  { timestamps: true, collection: "users" },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const username = config.ADMIN_USERNAME.toLowerCase();
const email = config.ADMIN_EMAIL.toLowerCase();
const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);

const user = await User.findOneAndUpdate(
  { $or: [{ username }, { email }] },
  {
    $set: {
      username,
      email,
      phone: config.ADMIN_PHONE,
      passwordHash,
      role: "admin",
    },
    $setOnInsert: {
      library: [],
      readingProgress: [],
      notifications: [],
    },
  },
  { upsert: true, new: true, runValidators: true },
);

console.log(`Admin ready: ${user.email}`);
await mongoose.disconnect();
