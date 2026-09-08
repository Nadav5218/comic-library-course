import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookmarkMinus,
  BookmarkPlus,
  Layers3,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { CategoryComicsResponse, Comic } from "@shared/api";
import { AppHeader } from "@/components/app/AppHeader";
import { ComicCover } from "@/components/app/ComicCover";
import { useAuth } from "@/hooks/useAuth";
import { lectureOrder } from "@/lib/comicSort";

export default function Series() {
  const { category = "" } = useParams<{ category: string }>();
  const { user, token, refreshUser } = useAuth();
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState<string | null>(null);
  const [groupMessage, setGroupMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/comics/category/${encodeURIComponent(category)}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          success: boolean;
          data?: CategoryComicsResponse;
          error?: string;
        };
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error || "Unable to load series");
        }
        setComics([...data.data.comics].sort(lectureOrder));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load series"),
      )
      .finally(() => setLoading(false));
  }, [category]);

  const groups = useMemo(() => {
    const map = new Map<string, Comic[]>();
    for (const comic of comics) {
      const name = comic.partName?.trim() || "Main story";
      const list = map.get(name) || [];
      list.push(comic);
      map.set(name, list);
    }
    return [...map.entries()];
  }, [comics]);

  const libraryIds = useMemo(
    () =>
      new Set(
        (user?.library || [])
          .map((item: any) => (typeof item === "string" ? item : item?._id))
          .filter(Boolean),
      ),
    [user?.library],
  );

  const updateGroup = async (name: string, items: Comic[]) => {
    if (!token || groupBusy) return;
    const ids = items.map((item) => item._id).filter(Boolean) as string[];
    if (!ids.length) return;
    const allSaved = ids.every((id) => libraryIds.has(id));
    setGroupBusy(name);
    setGroupMessage(null);
    try {
      const response = await fetch("/api/library/group", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          partName: items[0]?.partName?.trim() || null,
          action: allSaved ? "remove" : "add",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to update this section");
      }
      await refreshUser();
      setGroupMessage(
        allSaved
          ? `${name} was removed from your library.`
          : `${name} was added to your library.`,
      );
    } catch (err) {
      setGroupMessage(
        err instanceof Error ? err.message : "Unable to update this section",
      );
    } finally {
      setGroupBusy(null);
    }
  };

  const first = comics[0];
  const years = comics.map((comic) => comic.year).filter(Number.isFinite);
  const yearRange = years.length
    ? Math.min(...years) === Math.max(...years)
      ? String(years[0])
      : `${Math.min(...years)}–${Math.max(...years)}`
    : "—";

  return (
    <div className="page-shell min-h-screen pb-20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-[#667085] transition hover:text-[#111827]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to collection
        </Link>

        {loading ? (
          <div className="grid gap-7 md:grid-cols-[240px_1fr]">
            <div className="aspect-[2/3] animate-pulse rounded-[26px] bg-black/5" />
            <div className="h-72 animate-pulse rounded-[30px] bg-black/5" />
          </div>
        ) : error || !first ? (
          <div className="paper-card rounded-[30px] px-6 py-20 text-center">
            <Layers3 className="mx-auto h-9 w-9 text-[#8a93a1]" />
            <h1 className="mt-4 text-3xl font-black text-[#111827]">
              Series unavailable
            </h1>
            <p className="mt-2 text-sm text-[#667085]">
              {error || "No titles were found in this series."}
            </p>
          </div>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[34px] bg-[#111827] text-white shadow-2xl">
              <div className="absolute inset-0 soft-grid opacity-20" />
              <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#3157d5]/35 blur-3xl" />
              <div className="relative grid gap-8 p-7 sm:p-9 md:grid-cols-[220px_1fr] md:p-12">
                <div className="mx-auto w-full max-w-[220px]">
                  <div className="aspect-[2/3] overflow-hidden rounded-[24px] border-4 border-white/10 comic-shadow">
                    <ComicCover comic={first} />
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <div className="eyebrow text-[#e8a838]">
                    Series collection
                  </div>
                  <h1 className="mt-3 text-balance text-4xl font-black tracking-[-0.055em] md:text-6xl">
                    {category}
                  </h1>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 md:text-base">
                    {first.description ||
                      `A complete reading shelf for ${category}, organized in publication order.`}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.1em]">
                    <span className="rounded-full bg-white/8 px-4 py-2">
                      {comics.length} titles
                    </span>
                    <span className="rounded-full bg-white/8 px-4 py-2">
                      {yearRange}
                    </span>
                    <span className="rounded-full bg-white/8 px-4 py-2">
                      {groups.length} sections
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {groupMessage && (
              <div className="mt-8 rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm font-semibold text-[#344054]">
                {groupMessage}
              </div>
            )}

            <div className="mt-12 space-y-12">
              {groups.map(([name, items]) => (
                <section key={name}>
                  <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3157d5]/10 text-[#3157d5]">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-[#111827]">
                          {name}
                        </h2>
                        <div className="text-xs font-semibold text-[#8a93a1]">
                          {items.length} {items.length === 1 ? "title" : "titles"}
                        </div>
                      </div>
                    </div>
                    {user && (() => {
                      const ids = items
                        .map((item) => item._id)
                        .filter(Boolean) as string[];
                      const allSaved =
                        ids.length > 0 && ids.every((id) => libraryIds.has(id));
                      const GroupIcon = allSaved ? BookmarkMinus : BookmarkPlus;
                      return (
                        <button
                          type="button"
                          onClick={() => void updateGroup(name, items)}
                          disabled={groupBusy !== null}
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-black transition disabled:opacity-50 ${allSaved ? "border border-black/10 bg-white text-[#344054] hover:bg-red-50 hover:text-red-700" : "bg-[#3157d5] text-white hover:bg-[#2849bd]"}`}
                        >
                          <GroupIcon className="h-4 w-4" />
                          {groupBusy === name
                            ? "Updating…"
                            : allSaved
                              ? "Remove section"
                              : "Add section"}
                        </button>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {items.map((comic) => {
                      const progress = user?.readingProgress?.find(
                        (item) => item.comicId === comic._id,
                      );
                      const percent = progress?.totalPages
                        ? Math.min(
                            100,
                            Math.round(
                              (progress.page / progress.totalPages) * 100,
                            ),
                          )
                        : 0;
                      const destination =
                        user && comic._id ? `/comic/${comic._id}` : "/login";

                      return (
                        <article key={comic._id} className="group min-w-0">
                          <Link
                            to={destination}
                            className="relative block aspect-[2/3] overflow-hidden rounded-[22px] bg-[#111827] comic-shadow transition duration-300 group-hover:-translate-y-1.5"
                          >
                            <ComicCover
                              comic={comic}
                              className="transition duration-500 group-hover:scale-[1.025]"
                            />
                            {percent > 0 && (
                              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/35">
                                <div
                                  className="h-full bg-[#e8a838]"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            )}
                          </Link>
                          <div className="px-1 pt-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8a93a1]">
                              {comic.year}
                              {comic.partNumber != null
                                ? ` · Part ${comic.partNumber}`
                                : ""}
                            </div>
                            <Link
                              to={destination}
                              className="mt-1 flex items-start justify-between gap-2 text-[15px] font-black leading-5 text-[#111827] transition hover:text-[#3157d5]"
                            >
                              <span className="line-clamp-2">
                                {comic.title}
                              </span>
                              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
                            </Link>
                            <div className="mt-2 text-xs font-semibold text-[#7b8493]">
                              {comic.author}
                              {percent > 0 ? ` · ${percent}% read` : ""}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
