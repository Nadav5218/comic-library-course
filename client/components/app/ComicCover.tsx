import { BookOpen } from "lucide-react";
import type { Comic } from "@shared/api";

export function ComicCover({
  comic,
  className = "",
}: {
  comic: Comic;
  className?: string;
}) {
  const source = comic.coverImage || null;
  if (source) {
    return (
      <img
        src={source}
        alt={`${comic.title} cover`}
        loading="lazy"
        className={`h-full w-full bg-white object-contain ${className}`}
      />
    );
  }

  const initials = comic.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={`h-full w-full overflow-hidden bg-[#111827] text-[#fffdf8] ${className}`}
    >
      <div className="flex h-full flex-col justify-between p-5 soft-grid">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <div className="mb-3 text-4xl font-black tracking-[-0.06em] text-[#e8a838]">
            {initials || "CL"}
          </div>
          <div className="line-clamp-3 text-lg font-extrabold leading-tight">
            {comic.title}
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
            {comic.category}
          </div>
        </div>
      </div>
    </div>
  );
}
