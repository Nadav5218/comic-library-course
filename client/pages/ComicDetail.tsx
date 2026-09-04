import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  Info,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rows3,
} from "lucide-react";
import { Document, Page as PdfPage, pdfjs } from "react-pdf";
import pdfWorker from "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Comic, ComicDetailResponse } from "@shared/api";
import { useAuth } from "@/hooks/useAuth";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type FitMode = "page" | "width";

export default function ComicDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, refreshUser } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const currentPageRef = useRef(1);
  const totalPagesRef = useRef(0);
  const comicRef = useRef<Comic | null>(null);

  const [comic, setComic] = useState<Comic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>("page");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerWidth, setViewerWidth] = useState(900);
  const [viewerHeight, setViewerHeight] = useState(700);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  useEffect(() => {
    if (!id || !token) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/comics/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as {
          success: boolean;
          data?: ComicDetailResponse;
          error?: string;
        };
        if (!response.ok || !data.success || !data.data?.comic) {
          throw new Error(data.error || "Comic not found");
        }
        const value = data.data.comic;
        const restoredPage =
          data.data.progress?.page && data.data.progress.page > 0
            ? data.data.progress.page
            : 1;
        comicRef.current = value;
        currentPageRef.current = restoredPage;
        setComic(value);
        setCurrentPage(restoredPage);
        setPageInput(String(restoredPage));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load comic");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, token]);

  useEffect(() => {
  if (!viewerRef.current) return;

  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    setViewerWidth(entry.contentRect.width);
    setViewerHeight(entry.contentRect.height);
  });

  observer.observe(viewerRef.current);

  return () => observer.disconnect();
}, [loading]);

  const saveProgress = async (page: number, keepalive = false) => {
    const activeComic = comicRef.current;
    if (!id || !token || !activeComic) return false;
    const total = totalPagesRef.current;
    if (total <= 0) return false;

    const safePage = Math.max(1, Math.min(total, page));
    if (!keepalive) setSaveState("saving");

    try {
      const response = await fetch(`/api/comics/${id}/progress`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page: safePage, totalPages: total }),
        keepalive,
      });
      if (!response.ok) throw new Error("Unable to save reading progress");
      if (!keepalive) setSaveState("saved");
      return true;
    } catch {
      if (!keepalive) setSaveState("error");
      return false;
    }
  };

  useEffect(() => {
    comicRef.current = comic;
  }, [comic]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    totalPagesRef.current = numPages;
  }, [comic, numPages]);

  useEffect(() => {
    if (!comic || !token) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(
      () => void saveProgress(currentPageRef.current),
      650,
    );
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [currentPage, numPages, comic, token]);

  useEffect(() => {
    const saveBeforeLeaving = () => {
      void saveProgress(currentPageRef.current, true);
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveBeforeLeaving();
    };
    window.addEventListener("pagehide", saveBeforeLeaving);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeaving);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [id, token]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        const max = totalPagesRef.current;
        if (max > 0) setCurrentPage((page) => Math.min(max, page + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setCurrentPage((page) => Math.max(1, page - 1));
      }
      if (event.key === "+" || event.key === "=")
        setZoom((value) => Math.min(2.4, value + 0.15));
      if (event.key === "-") setZoom((value) => Math.max(0.55, value - 0.15));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const onFullscreen = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const inLibrary = useMemo(() => {
    const values = user?.library || [];
    return values.some(
      (item: any) => (typeof item === "string" ? item : item?._id) === id,
    );
  }, [user, id]);

  const toggleLibrary = async () => {
    if (!id || !token) return;
    const response = await fetch(`/api/library/${id}`, {
      method: inLibrary ? "DELETE" : "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) await refreshUser();
  };

  const goPage = (page: number) => {
    const max = numPages;
    if (!max) return;
    const next = Math.max(1, Math.min(max, page));
    setCurrentPage(next);
    setPageInput(String(next));
  };

  const submitPage = () => {
    const value = Number(pageInput);
    if (Number.isInteger(value)) goPage(value);
    else setPageInput(String(currentPage));
  };

  const toggleFullscreen = async () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await rootRef.current.requestFullscreen();
  };

  const goBack = async () => {
    await saveProgress(currentPageRef.current);
    await refreshUser();
    if ((location.state as any)?.fromLibrary) navigate("/library");
    else navigate("/");
  };

  const isMobileViewer = viewerWidth < 768;

const pageSize =
  isMobileViewer || fitMode === "width"
    ? {
        width:
          Math.max(240, Math.min(1200, viewerWidth - 48)) * zoom,
      }
    : {
        height:
          Math.max(380, Math.min(1200, viewerHeight - 48)) * zoom,
      };
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120] text-sm font-bold text-white/50">
        Opening reader…
      </div>
    );
  }

  if (error || !comic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b1120] px-6 text-center text-white">
        <h1 className="text-3xl font-black">Unable to open this comic</h1>
        <p className="mt-3 text-sm text-white/50">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 rounded-full bg-[#3157d5] px-5 py-2.5 text-sm font-black"
        >
          Back to library
        </button>
      </div>
    );
  }

  const totalPages = numPages;

  return (
    <div
      ref={rootRef}
      className="flex h-screen min-h-[620px] flex-col overflow-hidden bg-[#0b1120] text-white"
    >
      <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#111827]/95 px-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={goBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSidebarOpen((value) => !value)}
            className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 md:flex"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-black">{comic.title}</div>
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
              {comic.category} · {comic.author}
            </div>
            <div className="mt-0.5 text-[11px] font-black text-[#e8a838]">
              Page {currentPage}
              {totalPages > 0 ? ` of ${totalPages}` : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1 rounded-full bg-white/5 p-1 sm:flex">
            <button
              onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center text-[11px] font-black text-white/55">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((value) => Math.min(2.4, value + 0.15))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => {
              setFitMode("page");
              setZoom(1);
            }}
            className={`hidden h-9 items-center gap-2 rounded-full px-3 text-xs font-black lg:flex ${fitMode === "page" ? "bg-[#3157d5] text-white" : "bg-white/5 text-white/55 hover:bg-white/10"}`}
          >
            <Expand className="h-3.5 w-3.5" /> Fit page
          </button>
          <button
            onClick={() => {
              setFitMode("width");
              setZoom(1);
            }}
            className={`hidden h-9 items-center gap-2 rounded-full px-3 text-xs font-black lg:flex ${fitMode === "width" ? "bg-[#3157d5] text-white" : "bg-white/5 text-white/55 hover:bg-white/10"}`}
          >
            <Rows3 className="h-3.5 w-3.5" /> Fit width
          </button>
          <button
            onClick={toggleLibrary}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${inLibrary ? "bg-[#2a9d8f] text-white" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
            title={inLibrary ? "Remove from library" : "Add to library"}
          >
            {inLibrary ? (
              <Check className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setInfoOpen((value) => !value)}
            className={`flex h-9 w-9 items-center justify-center rounded-full ${infoOpen ? "bg-[#e8a838] text-[#111827]" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && totalPages > 0 && (
          <aside className="hidden w-24 shrink-0 overflow-y-auto border-r border-white/10 bg-[#111827] py-3 scrollbar-thin md:block">
            <div className="space-y-1 px-2">
              {Array.from({ length: totalPages }).map((_, index) => {
                const number = index + 1;
                return (
                  <button
                    key={number}
                    onClick={() => goPage(number)}
                    className={`flex h-10 w-full items-center justify-center rounded-xl text-xs font-black transition ${currentPage === number ? "bg-[#3157d5] text-white" : "text-white/35 hover:bg-white/5 hover:text-white/70"}`}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        <main
          ref={viewerRef}
          className="relative min-w-0 flex-1 overflow-auto bg-[#080d18] scrollbar-thin"
        >
          <div className="flex min-h-full min-w-full items-center justify-center p-6">
            {comic.pdfFile ? (
              <Document
                file={comic.pdfFile}
                onLoadSuccess={({ numPages: count }) => {
                  totalPagesRef.current = count;
                  setNumPages(count);
                  setCurrentPage((value) => {
                    const next = Math.max(1, Math.min(count, value));
                    currentPageRef.current = next;
                    setPageInput(String(next));
                    return next;
                  });
                  setPdfError(null);
                }}
                onLoadError={(err) =>
                  setPdfError(err.message || "Unable to load PDF")
                }
                loading={
                  <div className="text-sm font-bold text-white/35">
                    Decrypting private PDF…
                  </div>
                }
                error={
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-200">
                    {pdfError || "Unable to load PDF"}
                  </div>
                }
              >
                <PdfPage
                  pageNumber={currentPage}
                  {...pageSize}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="overflow-hidden rounded-[4px] shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
                />
              </Document>
            ) : (
              <div className="text-sm font-bold text-red-300">
                PDF unavailable
              </div>
            )}
          </div>

          {infoOpen && (
            <div className="absolute right-4 top-4 z-30 w-[min(360px,calc(100%-2rem))] rounded-[24px] border border-white/10 bg-[#111827]/95 p-5 shadow-2xl backdrop-blur-xl">
              <div className="eyebrow text-[#e8a838]">Comic details</div>
              <h2 className="mt-2 text-xl font-black">{comic.title}</h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-white/35">Author</dt>
                  <dd className="text-right font-bold text-white/75">
                    {comic.author}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/35">Series</dt>
                  <dd className="text-right font-bold text-white/75">
                    {comic.category}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/35">Year</dt>
                  <dd className="text-right font-bold text-white/75">
                    {comic.year}
                  </dd>
                </div>
                {comic.partName && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/35">Arc</dt>
                    <dd className="text-right font-bold text-white/75">
                      {comic.partName}
                    </dd>
                  </div>
                )}
              </dl>
              {comic.description && (
                <p className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-white/50">
                  {comic.description}
                </p>
              )}
              <div className="mt-5 text-[11px] font-semibold leading-5 text-white/30">
                Arrow keys change pages. + and − control zoom. Reading progress
                saves automatically.
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="relative z-40 flex h-20 shrink-0 items-center justify-center border-t border-white/10 bg-[#111827]/98 px-3 shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-2 py-2 shadow-xl">
          <button
            onClick={() => goPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-white transition hover:bg-white/15 disabled:opacity-20"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-[190px] items-center justify-center gap-2 px-3">
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/45">
              Page
            </span>
            <input
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitPage()}
              onBlur={submitPage}
              inputMode="numeric"
              aria-label="Current page"
              className="h-10 w-16 rounded-xl border border-[#3157d5]/60 bg-[#3157d5] px-2 text-center text-lg font-black text-white outline-none focus:ring-2 focus:ring-white/30"
            />
            <span className="text-base font-black text-white/80">
              of {totalPages || "–"}
            </span>
          </div>
          <button
            onClick={() => goPage(currentPage + 1)}
            disabled={!totalPages || currentPage >= totalPages}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-white transition hover:bg-white/15 disabled:opacity-20"
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="absolute right-4 hidden text-[11px] font-bold sm:block">
          <span
            className={
              saveState === "error"
                ? "text-red-300"
                : saveState === "saving"
                  ? "text-white/45"
                  : "text-[#2a9d8f]"
            }
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "error"
                ? "Progress not saved"
                : saveState === "saved"
                  ? "Progress saved"
                  : "Auto-save on"}
          </span>
        </div>
      </footer>
    </div>
  );
}
