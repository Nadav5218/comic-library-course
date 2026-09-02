import type { UserRole } from "@shared/api";
export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  username?: string;
}
