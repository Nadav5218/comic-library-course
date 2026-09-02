import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  Edit3,
  Filter,
  Layers3,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import type {
  AdminStatsResponse,
  Comic,
  ComicsResponse,
  User,
} from "@shared/api";
import { AppHeader } from "@/components/app/AppHeader";
import { ComicCover } from "@/components/app/ComicCover";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { generatePdfCover } from "@/lib/pdfCover";
import { lectureOrder } from "@/lib/comicSort";

const accents = ["#3157d5", "#2a9d8f", "#e65f5c", "#e8a838", "#7557d9"];

function progressFor(user: User | null, comicId?: string) {
  if (!comicId) return null;
  return (
    user?.readingProgress?.find((item) => item.comicId === comicId) || null
  );
}

function libraryIds(user: User | null) {
  const values = user?.library || [];
  return new Set(
    values
      .map((item: any) => (typeof item === "string" ? item : item?._id))
      .filter(Boolean),
  );
}

function ComicCard({
  comic,
  user,
  admin,
  inLibrary,
  onToggleLibrary,
  onDelete,
}: {
  comic: Comic;
  user: User | null;
  admin: boolean;
  inLibrary: boolean;
  onToggleLibrary: (comic: Comic) => void;
  onDelete: (comic: Comic) => void;
}) {
  const progress = progressFor(user, comic._id);
  const percent = progress?.totalPages
    ? Math.min(100, Math.round((progress.page / progress.totalPages) * 100))
    : 0;

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[22px] bg-[#111827] comic-shadow transition duration-300 group-hover:-translate-y-1.5">
        <Link
          to={comic._id && user ? `/comic/${comic._id}` : user ? "/" : "/login"}
        >
          <ComicCover comic={comic} />
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/65 to-transparent opacity-0 transition group-hover:opacity-100" />
        {percent > 0 && (
          <div className="absolute inset-x-0 bottom-0 z-20 h-1.5 bg-black/35">
            <div
              className="h-full bg-[#e8a838]"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        {user && !admin && (
          <button
            type="button"
            onClick={() => onToggleLibrary(comic)}
            className={`absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 shadow-lg backdrop-blur transition ${
              inLibrary
                ? "bg-[#2a9d8f] text-white"
                : "bg-[#111827]/75 text-white hover:bg-[#3157d5]"
            }`}
            aria-label={inLibrary ? "Remove from library" : "Add to library"}
          >
            {inLibrary ? (
              <Check className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
        )}
        {admin && (
          <div className="absolute right-3 top-3 z-20 flex gap-2 opacity-0 transition group-hover:opacity-100">
            <Link
              to={`/edit-comic/${comic._id}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111827] shadow-lg"
            >
              <Edit3 className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => onDelete(comic)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e65f5c] text-white shadow-lg"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="px-1 pt-4">
        <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#7b8493]">
          <span>{comic.category}</span>
          <span>•</span>
          <span>{comic.year}</span>
        </div>
        <Link
          to={comic._id && user ? `/comic/${comic._id}` : user ? "/" : "/login"}
          className="line-clamp-2 text-[15px] font-black leading-5 text-[#111827] transition hover:text-[#3157d5]"
        >
          {comic.title}
        </Link>
        <div className="mt-2 flex items-center justify-between text-xs text-[#7b8493]">
          <span className="truncate">{comic.author}</span>
          {percent > 0 && progress && (
            <span className="font-extrabold text-[#3157d5]">
              Page {progress.page} · {percent}%
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const { user: initialUser, token, isAdmin, refreshUser } = useAuth();
  const [user, setUser] = useState<User | null>(initialUser);
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [year, setYear] = useState("all");
  const [reading, setReading] = useState("all");
  const [sortMode, setSortMode] = useState("lecture");
  const [showFilters, setShowFilters] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStatsResponse | null>(null);
  const [comicToDelete, setComicToDelete] = useState<Comic | null>(null);

  const load = async () => {
    setLoading(true);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const response = await fetch("/api/comics", { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("Library requests were temporarily rate limited");
          }
          throw new Error(`Library request failed with ${response.status}`);
        }

        const data = (await response.json()) as {
          success: boolean;
          data?: ComicsResponse;
        };

        if (!data.success || !data.data) {
          throw new Error("Unable to load library");
        }

        setComics(data.data.comics);
        setMessage(null);
        setLoading(false);
        return;
      } catch (error) {
        if (attempt === 5) {
          console.error("Unable to load library", error);
          setMessage("The library could not be loaded right now.");
          setLoading(false);
          return;
        }

        await new Promise((resolve) =>
          window.setTimeout(resolve, 500 + attempt * 500),
        );
      }
    }
  };

  useEffect(() => {
    void load();
    if (token) {
      void refreshUser().then((fresh) => setUser(fresh));
    }
  }, []);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    if (!isAdmin || !token) {
      setAdminStats(null);
      return;
    }
    fetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load admin stats");
        return response.json();
      })
      .then((data) => setAdminStats(data.data || null))
      .catch(() => setAdminStats(null));
  }, [isAdmin, token, comics.length]);

  const categories = useMemo(
    () => [...new Set(comics.map((comic) => comic.category))].sort(),
    [comics],
  );
  const years = useMemo(
    () => [...new Set(comics.map((comic) => comic.year))].sort((a, b) => b - a),
    [comics],
  );
  const ids = useMemo(() => libraryIds(user), [user]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return comics.filter((comic) => {
      const matchesText =
        !needle ||
        [comic.title, comic.author, comic.category, comic.partName || ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      const matchesCategory = category === "all" || comic.category === category;
      const matchesYear = year === "all" || String(comic.year) === year;
      const progress = progressFor(user, comic._id);
      const percent = progress?.totalPages
        ? Math.round((progress.page / progress.totalPages) * 100)
        : 0;
      const matchesReading =
        reading === "all" ||
        (reading === "new" && percent === 0) ||
        (reading === "reading" && percent > 0 && percent < 100) ||
        (reading === "done" && percent >= 100);
      return matchesText && matchesCategory && matchesYear && matchesReading;
    });
  }, [comics, query, category, year, reading, user]);

  const sortedFiltered = useMemo(() => {
    const items = [...filtered];

    if (sortMode === "recent") {
      return items.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
    }

    if (sortMode === "year") {
      return items.sort((a, b) => b.year - a.year || lectureOrder(a, b));
    }

    if (sortMode === "title") {
      return items.sort((a, b) =>
        a.title.localeCompare(b.title, "he", {
          numeric: true,
          sensitivity: "base",
        }),
      );
    }

    return items.sort(lectureOrder);
  }, [filtered, sortMode]);

  const recent = useMemo(
    () =>
      [...comics]
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, 5),
    [comics],
  );

  const featured = recent[0] || comics[0];

  const grouped = useMemo(() => {
    const map = new Map<string, Comic[]>();
    for (const comic of sortedFiltered) {
      const list = map.get(comic.category) || [];
      list.push(comic);
      map.set(comic.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sortedFiltered]);

  const toggleLibrary = async (comic: Comic) => {
    if (!token || !comic._id) {
      navigate("/login");
      return;
    }
    const inLibrary = ids.has(comic._id);
    const response = await fetch(`/api/library/${comic._id}`, {
      method: inLibrary ? "DELETE" : "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const fresh = await refreshUser();
    setUser(fresh);
  };

  const deleteComic = async (comic: Comic) => {
    if (!token || !comic._id) return;
    const response = await fetch(`/api/comics/${comic._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setMessage("The item could not be deleted.");
      return;
    }
    setComicToDelete(null);
    await load();
  };

  const repairCovers = async () => {
    if (!token || !isAdmin) return;
    const missing = comics.filter(
      (comic) => !comic.coverImage && comic._id,
    );
    if (!missing.length) {
      setMessage("Every PDF already has a cover.");
      return;
    }
    setRepairing(true);
    setMessage(null);
    try {
      let repaired = 0;
      let failed = 0;
      for (let index = 0; index < missing.length; index += 1) {
        const comic = missing[index];
        setRepairProgress(`${index + 1} / ${missing.length} · ${comic.title}`);
        try {
          const detailResponse = await fetch(`/api/comics/${comic._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!detailResponse.ok) throw new Error("Unable to open PDF");
          const detail = await detailResponse.json();
          const pdfUrl = detail.data?.comic?.pdfFile;
          if (!pdfUrl) throw new Error("PDF URL is missing");
          const pdfResponse = await fetch(pdfUrl);
          if (!pdfResponse.ok) throw new Error("Unable to download PDF");
          const blob = await pdfResponse.blob();
          const pdfFile = new File([blob], `${comic.title}.pdf`, {
            type: "application/pdf",
          });
          const cover = await generatePdfCover(pdfFile);
          const form = new FormData();
          form.append("coverImage", cover);
          const coverResponse = await fetch(`/api/comics/${comic._id}/cover`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          if (!coverResponse.ok) throw new Error("Unable to save cover");
          repaired += 1;
        } catch {
          failed += 1;
        }
      }
      await load();
      setMessage(
        failed === 0
          ? `${repaired} missing cover${repaired === 1 ? " was" : "s were"} rebuilt successfully.`
          : `${repaired} cover${repaired === 1 ? "" : "s"} rebuilt, ${failed} failed.`,
      );
    } catch {
      setMessage(
        "Cover repair stopped because one of the files could not be processed.",
      );
    } finally {
      setRepairing(false);
      setRepairProgress("");
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <AppHeader />
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="h-72 animate-pulse rounded-[34px] bg-black/5" />
          <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[2/3] animate-pulse rounded-[22px] bg-black/5"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell pb-20">
      <AppHeader />

      <main>
        {!user && featured && (
          <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[36px] bg-[#111827] text-white shadow-2xl">
              <div className="absolute inset-0 soft-grid opacity-30" />
              <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#3157d5]/35 blur-3xl" />
              <div className="absolute bottom-[-7rem] left-[28%] h-72 w-72 rounded-full bg-[#2a9d8f]/20 blur-3xl" />
              <div className="relative grid min-h-[440px] gap-10 p-8 md:grid-cols-[1.3fr_0.7fr] md:p-12 lg:p-16">
                <div className="flex max-w-2xl flex-col justify-center">
                  <div className="mb-5 flex items-center gap-2 text-[#e8a838]">
                    <Sparkles className="h-4 w-4" />
                    <span className="eyebrow">Fresh from the library</span>
                  </div>
                  <h1 className="max-w-xl text-balance text-4xl font-black leading-[0.96] tracking-[-0.055em] md:text-6xl">
                    {featured.title}
                  </h1>
                  <p className="mt-6 max-w-xl text-base leading-7 text-white/65 md:text-lg">
                    {featured.description ||
                      `${featured.author} · ${featured.category} · ${featured.year}`}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      to={
                        user && featured._id
                          ? `/comic/${featured._id}`
                          : "/login"
                      }
                      className="flex items-center gap-2 rounded-full bg-[#3157d5] px-6 py-3 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5"
                    >
                      {user ? "Start reading" : "Sign in to read"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("library-grid")
                          ?.scrollIntoView()
                      }
                      className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/10"
                    >
                      Browse collection
                    </button>
                  </div>
                </div>
                <div className="relative mx-auto hidden w-full max-w-[260px] items-center md:flex">
                  <div className="absolute -left-7 top-16 h-[78%] w-full rotate-[-8deg] rounded-[24px] bg-[#e65f5c] opacity-70" />
                  <div className="absolute -right-7 top-9 h-[84%] w-full rotate-[8deg] rounded-[24px] bg-[#e8a838] opacity-70" />
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[24px] border-4 border-white/10 comic-shadow">
                    <ComicCover comic={featured} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {message && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-semibold text-[#344054]">
              <span>{message}</span>
              <button onClick={() => setMessage(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="mb-10 space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  [
                    "Total comics",
                    adminStats?.totalComics ?? comics.length,
                    BookOpen,
                    "#3157d5",
                  ],
                  [
                    "Users",
                    adminStats?.totalUsers ?? "—",
                    UsersRound,
                    "#2a9d8f",
                  ],
                  [
                    "Pending review",
                    adminStats?.pendingRequests ?? "—",
                    UploadCloud,
                    "#e8a838",
                  ],
                  [
                    "Total submissions",
                    adminStats?.totalRequests ?? "—",
                    Layers3,
                    "#7557d9",
                  ],
                ].map(([label, value, Icon, color]: any) => (
                  <div key={label} className="paper-card rounded-[24px] p-5">
                    <div
                      className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl text-white"
                      style={{ backgroundColor: color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-2xl font-black tracking-[-0.04em] text-[#111827]">
                      {value}
                    </div>
                    <div className="mt-1 text-xs font-bold uppercase tracking-[0.11em] text-[#8a93a1]">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="paper-card rounded-[24px] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-black text-[#111827]">
                        Recent activity
                      </div>
                      <div className="text-sm text-[#667085]">
                        The latest additions to the catalog.
                      </div>
                    </div>
                    <Link
                      to="/requests"
                      className="text-xs font-black text-[#3157d5]"
                    >
                      Review queue
                    </Link>
                  </div>
                  <div className="mt-4 divide-y divide-black/5">
                    {(adminStats?.recentUploads || []).length > 0 ? (
                      adminStats!.recentUploads.map((item) => (
                        <Link
                          key={item._id}
                          to={`/comic/${item._id}`}
                          className="flex items-center justify-between gap-4 py-3 text-sm transition hover:text-[#3157d5]"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-extrabold text-[#111827]">
                              {item.title}
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-[#8a93a1]">
                              {item.category}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[#9aa2af]" />
                        </Link>
                      ))
                    ) : (
                      <div className="py-7 text-sm font-semibold text-[#8a93a1]">
                        No recent activity yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#7557d9]/15 bg-[#7557d9]/8 p-5">
                  <div className="font-black text-[#111827]">
                    Cover maintenance
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[#667085]">
                    {
                      comics.filter((item) => !item.coverImage)
                        .length
                    }{" "}
                    PDFs still need a permanent page-one cover.
                  </div>
                  <div className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-[#7557d9]">
                    Private S3 storage
                  </div>
                  <Button
                    onClick={repairCovers}
                    disabled={repairing}
                    className="mt-5 w-full rounded-full bg-[#7557d9] hover:bg-[#6546ca]"
                  >
                    <WandSparkles className="mr-2 h-4 w-4" />
                    {repairing
                      ? repairProgress || "Working…"
                      : "Repair missing covers"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div id="library-grid" className="scroll-mt-28">
            <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <div className="eyebrow text-[#2a9d8f]">
                  {user && !isAdmin ? "Your lectures" : "The collection"}
                </div>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#111827]">
                  {user && !isAdmin
                    ? "Everything in one place"
                    : "Find your next read"}
                </h2>
              </div>
              <div className="flex flex-1 items-center gap-2 lg:max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a93a1]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, author or series"
                    className="focus-ring h-12 w-full rounded-full border border-black/10 bg-white/75 pl-11 pr-4 text-sm font-semibold text-[#111827] shadow-sm placeholder:text-[#9aa2af]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((value) => !value)}
                  className={`focus-ring flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-black transition ${showFilters ? "border-[#3157d5] bg-[#3157d5] text-white" : "border-black/10 bg-white/75 text-[#344054]"}`}
                >
                  <Filter className="h-4 w-4" /> Filters
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="mb-7 grid gap-3 rounded-[24px] border border-black/10 bg-white/65 p-4 md:grid-cols-4">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-[#344054]"
                >
                  <option value="all">All series</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-[#344054]"
                >
                  <option value="all">All years</option>
                  {years.map((item) => (
                    <option key={item} value={String(item)}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={reading}
                  onChange={(event) => setReading(event.target.value)}
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-[#344054]"
                >
                  <option value="all">Any reading status</option>
                  <option value="new">Not started</option>
                  <option value="reading">In progress</option>
                  <option value="done">Completed</option>
                </select>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-[#344054]"
                >
                  <option value="lecture">Lecture order: 1, 2, 3…</option>
                  <option value="recent">Recently added</option>
                  <option value="year">Newest year</option>
                  <option value="title">Title</option>
                </select>
              </div>
            )}

            {grouped.length === 0 ? (
              <div className="paper-card rounded-[30px] px-6 py-16 text-center">
                <Search className="mx-auto h-8 w-8 text-[#8a93a1]" />
                <h3 className="mt-4 text-xl font-black text-[#111827]">
                  No matches
                </h3>
                <p className="mt-2 text-sm text-[#7b8493]">
                  Try changing your search or filters.
                </p>
              </div>
            ) : (
              <div className="space-y-12">
                {grouped.map(([name, items], groupIndex) => (
                  <section key={name}>
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              accents[groupIndex % accents.length],
                          }}
                        />
                        <h3 className="truncate text-xl font-black text-[#111827]">
                          {name}
                        </h3>
                        <span className="shrink-0 text-xs font-bold text-[#9aa2af]">
                          {items.length} titles
                        </span>
                      </div>
                      <Link
                        to={`/series/${encodeURIComponent(name)}`}
                        className="hidden shrink-0 items-center gap-1 text-xs font-black text-[#3157d5] transition hover:gap-2 sm:flex"
                      >
                        View series <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                      {items.map((comic) => (
                        <ComicCard
                          key={comic._id}
                          comic={comic}
                          user={user}
                          admin={isAdmin}
                          inLibrary={Boolean(comic._id && ids.has(comic._id))}
                          onToggleLibrary={toggleLibrary}
                          onDelete={setComicToDelete}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {!user && (
            <div className="mt-16 overflow-hidden rounded-[30px] bg-[#3157d5] p-8 text-white md:p-10">
              <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
                <div>
                  <div className="eyebrow text-white/60">
                    Your reading space
                  </div>
                  <h3 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                    Save progress. Build a library. Keep going.
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                    Create an account to keep your place across every comic and
                    submit new material for review.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="shrink-0 rounded-full bg-white px-6 py-3 text-sm font-black text-[#3157d5]"
                >
                  Create your space
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>

      <AlertDialog
        open={Boolean(comicToDelete)}
        onOpenChange={(open) => !open && setComicToDelete(null)}
      >
        <AlertDialogContent className="bg-[#fffdf8]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              {comicToDelete
                ? `“${comicToDelete.title}” will be removed from the catalog, reader progress and private storage.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => comicToDelete && void deleteComic(comicToDelete)}
              className="bg-[#d04745] text-white hover:bg-[#b93b39]"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
