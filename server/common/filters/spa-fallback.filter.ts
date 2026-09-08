import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import path from "path";
@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  constructor(private readonly spaDistPath: string | null) {}
  catch(_exception: NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      res.status(404).json({ error: "API endpoint not found" });
      return;
    }
    if (this.spaDistPath) {
      res.status(200).sendFile(path.join(this.spaDistPath, "index.html"));
      return;
    }
    res.status(404).json({ error: "Not found" });
  }
}
