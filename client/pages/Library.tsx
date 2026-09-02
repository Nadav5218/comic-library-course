import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock3, Layers3, RotateCcw, Search, Trash2 } from "lucide-react";
import type { Comic } from "@shared/api";
import { AppHeader } from "@/components/app/AppHeader";
import { ComicCover } from "@/components/app/ComicCover";
import { useAuth } from "@/hooks/useAuth";
import { lectureOrder } from "@/lib/comicSort";

export default function Library() {
  const { user, token, refreshUser } = useAuth();
  const [comics, setComics] = useState<Comic[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/library", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Unable to load library");
      setComics(data.data?.comics || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    if (token) void refreshUser();
  }, [token]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = !needle
      ? comics
      : comics.filter((comic) =>
          [comic.title, comic.author, comic.category, comic.partName || ""]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        );
    return [...matches].sort(lectureOrder);
  }, [comics, query]);

  const remove = async (comic: Comic) => {
    if (!token || !comic._id) return;
    const response = await fetch(`/api/library/${comic._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    setComics((items) => items.filter((item) => item._id !== comic._id));
    await refreshUser();
  };

  const removeSection = async (comic: Comic) => {
    if (!token || groupBusy) return;
    const sectionName = comic.partName?.trim() || "Main story";
    if (
      !window.confirm(
        `Remove every saved title from ${comic.category} · ${sectionName}?`,
      )
    ) {
      return;
    }
    const key = `${comic.category}::${comic.partName?.trim() || ""}`;
    setGroupBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/library/group", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: comic.category,
          partName: comic.partName?.trim() || null,
          action: "remove",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to remove this section");
      }
      setComics((items) =>
        items.filter(
          (item) =>
            item.category !== comic.category ||
            (item.partName?.trim() || "") !== (comic.partName?.trim() || ""),
        ),
      );
      await refreshUser();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to remove this section",
      );
    } finally {
      setGroupBusy(null);
    }
  };

  const resetProgress = async (comic: Comic) => {
    if (!token || !comic._id || resettingId) return;
    setResettingId(comic._id);
    setError(null);
    try {
      const response = await fetch(`/api/comics/${comic._id}/progress`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to reset reading progress");
      }
      await refreshUser();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to reset reading progress",
      );
    } finally {
      setResettingId(null);
    }
  };

  const progress = (comic: Comic) => {
    const item = user?.readingProgress?.find(
      (entry) => entry.comicId === comic._id,
    );
    if (!item?.totalPages) return { percent: 0, page: 0 };
    return {
      percent: Math.min(100, Math.round((item.page / item.totalPages) * 100)),
      page: item.page,
    };
  };

  return (
    <div className="page-shell pb-20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="eyebrow text-[#2a9d8f]">Your shelf</div>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#111827]">
              My Library
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">
              The titles you saved, with your reading position ready whenever
              you come back.
            </p>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a93a1]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your library"
              className="focus-ring h-12 w-full rounded-full border border-black/10 bg-white/75 pl-11 pr-4 text-sm font-semibold"
            />
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="paper-card rounded-[24px] p-5">
            <div className="text-3xl font-black text-[#111827]">
              {comics.length}
            </div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#8a93a1]">
              Saved titles
            </div>
          </div>
          <div className="paper-card rounded-[24px] p-5">
            <div className="text-3xl font-black text-[#3157d5]">
              {
                comics.filter((comic) => {
                  const value = progress(comic).percent;
                  return value > 0 && value < 100;
                }).length
              }
            </div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#8a93a1]">
              In progress
            </div>
          </div>
          <div className="paper-card rounded-[24px] p-5">
            <div className="text-3xl font-black text-[#2a9d8f]">
              {comics.filter((comic) => progress(comic).percent >= 100).length}
            </div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#8a93a1]">
              Completed
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[2/3] animate-pulse rounded-[22px] bg-black/5"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="paper-card rounded-[30px] px-6 py-20 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-[#9aa2af]" />
            <h2 className="mt-4 text-2xl font-black text-[#111827]">
              {comics.length
                ? "Nothing matched your search"
                : "Your shelf is waiting"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7b8493]">
              {comics.length
                ? "Try a different title, author or series."
                : "Browse the collection and save anything you want to keep close."}
            </p>
            {!comics.length && (
              <Link
                to="/"
                className="mt-6 inline-flex rounded-full bg-[#3157d5] px-5 py-2.5 text-sm font-black text-white"
              >
                Browse collection
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((comic) => {
              const status = progress(comic);
              return (
                <article key={comic._id} className="group min-w-0">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[22px] bg-[#111827] comic-shadow transition duration-300 group-hover:-translate-y-1.5">
                    <Link to={`/comic/${comic._id}`}>
                      <ComicCover comic={comic} />
                    </Link>
                    <div className="absolute right-3 top-3 flex gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      {status.page > 0 && (
                        <button
                          type="button"
                          onClick={() => void resetProgress(comic)}
                          disabled={resettingId === comic._id}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111827]/75 text-white backdrop-blur transition hover:bg-[#3157d5] disabled:opacity-50"
                          aria-label="Reset reading progress"
                          title="Reset reading progress"
                        >
                          <RotateCcw
                            className={`h-4 w-4 ${resettingId === comic._id ? "animate-spin" : ""}`}
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeSection(comic)}
                        disabled={
                          groupBusy ===
                          `${comic.category}::${comic.partName?.trim() || ""}`
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111827]/75 text-white backdrop-blur transition hover:bg-[#e8a838] disabled:opacity-50"
                        aria-label="Remove section from library"
                        title="Remove this section from library"
                      >
                        <Layers3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(comic)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111827]/75 text-white backdrop-blur transition hover:bg-[#e65f5c]"
                        aria-label="Remove from library"
                        title="Remove from library"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {status.percent > 0 && (
                      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/35">
                        <div
                          className="h-full bg-[#e8a838]"
                          style={{ width: `${status.percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="px-1 pt-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8a93a1]">
                      {comic.category}
                    </div>
                    <Link
                      to={`/comic/${comic._id}`}
                      className="mt-1 line-clamp-2 text-[15px] font-black leading-5 text-[#111827] hover:text-[#3157d5]"
                    >
                      {comic.title}
                    </Link>
                    <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#7b8493]">
                      <Clock3 className="h-3.5 w-3.5" />
                      {status.page > 0
                        ? `Page ${status.page} · ${status.percent}%`
                        : "Not started"}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
