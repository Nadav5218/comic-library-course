import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminService } from "./admin.service";

@Controller("api/admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  stats() {
    return this.adminService.stats();
  }
}
