import type { UserRole } from "@shared/api";

export interface AuthUser {
  id: string;
  role: UserRole;
}
