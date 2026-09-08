export interface Comic {
  _id?: string;
  title: string;
  author: string;
  year: number;
  category: string;
  pdfFile?: string | null;
  coverImage?: string | null;
  description?: string;
  partNumber?: number | null;
  partName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComicsResponse {
  comics: Comic[];
}

export interface ComicDetailResponse {
  comic: Comic;
  progress?: ReadingProgress | null;
}

export interface CategoriesResponse {
  categories: string[];
}

export interface CategoryComicsResponse {
  category: string;
  comics: Comic[];
}

export interface CreateComicRequest {
  title: string;
  author: string;
  year: number;
  category: string;
  description?: string;
  pdfFile?: string | null;
  coverImage?: string | null;
  partNumber?: number | null;
  partName?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type UserRole = "admin" | "user";

export interface ReadingProgress {
  comicId: string;
  page: number;
  totalPages?: number;
  updatedAt?: string;
}

export interface UserNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  read: boolean;
  createdAt?: string;
}

export interface User {
  _id: string;
  username?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  readingProgress?: ReadingProgress[];
  library?: string[] | Comic[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LibraryResponse {
  comics: Comic[];
}

export type ComicRequestStatus = "pending" | "approved" | "rejected";

export interface ComicRequest {
  _id: string;
  requestedBy: string;
  requesterUsername?: string;
  requesterEmail: string;
  requesterPhone?: string;
  title: string;
  author: string;
  year: number;
  category: string;
  description?: string;
  partNumber?: number | null;
  partName?: string | null;
  pdfFile: string | null;
  coverImage?: string | null;
  originalFileName?: string;
  status: ComicRequestStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  approvedComicId?: string | null;
  adminNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComicRequestSummary {
  _id: string;
  requesterUsername?: string;
  requesterEmail?: string;
  title: string;
  author: string;
  year: number;
  category: string;
  coverImage?: string | null;
  status: ComicRequestStatus;
  approvedComicId?: string | null;
  adminNote?: string | null;
  createdAt?: string;
}

export interface ComicRequestsResponse {
  requests: ComicRequestSummary[];
}

export interface ComicRequestDetailResponse {
  request: ComicRequest;
}

export interface PendingRequestsCountResponse {
  pending: number;
}

export interface AdminStatsResponse {
  totalComics: number;
  totalUsers: number;
  pendingRequests: number;
  totalRequests: number;
  recentUploads: Array<{
    _id: string;
    title: string;
    category: string;
    createdAt?: string;
  }>;
}
