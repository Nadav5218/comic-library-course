import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  FileSearch,
  Search,
  XCircle,
} from "lucide-react";
import type { ComicRequest, ComicRequestStatus } from "@shared/api";
import { AppHeader } from "@/components/app/AppHeader";
import { useAuth } from "@/hooks/useAuth";

const filters: { value: "all" | ComicRequestStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const statusConfig = {
  pending: {
    icon: Clock3,
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  approved: {
    icon: CheckCircle2,
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export default function AdminRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<ComicRequest[]>([]);
  const [status, setStatus] = useState<"all" | ComicRequestStatus>("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Unable to load requests");
      setRequests(data.data?.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((request) => {
      const statusMatch = status === "all" || request.status === status;
      const textMatch =
        !needle ||
        [
          request.title,
          request.author,
          request.category,
          request.requesterUsername || "",
          request.requesterEmail,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return statusMatch && textMatch;
    });
  }, [requests, status, query]);

  return (
    <div className="page-shell pb-20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="eyebrow text-[#7557d9]">Administrator workspace</div>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#111827]">
            Submission review queue
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">
            Review private PDFs, adjust metadata and publish approved
            submissions directly into the library.
          </p>
        </div>

        <div className="mb-7 grid gap-4 sm:grid-cols-3">
          {(["pending", "approved", "rejected"] as const).map((item) => {
            const config = statusConfig[item];
            const Icon = config.icon;
            return (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`paper-card rounded-[24px] p-5 text-left transition hover:-translate-y-0.5 ${status === item ? "ring-2 ring-[#7557d9] ring-offset-2 ring-offset-[#f6f1e8]" : ""}`}
              >
                <Icon className="h-5 w-5 text-[#667085]" />
                <div className="mt-5 text-3xl font-black text-[#111827]">
                  {requests.filter((request) => request.status === item).length}
                </div>
                <div className="mt-1 text-xs font-black uppercase tracking-[0.11em] text-[#8a93a1]">
                  {config.label}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.value}
                onClick={() => setStatus(item.value)}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${status === item.value ? "bg-[#111827] text-white" : "border border-black/10 bg-white/70 text-[#667085]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a93a1]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search queue"
              className="focus-ring h-11 w-full rounded-full border border-black/10 bg-white/75 pl-11 pr-4 text-sm font-semibold"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-[22px] bg-black/5"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="paper-card rounded-[30px] px-6 py-20 text-center">
            <FileSearch className="mx-auto h-10 w-10 text-[#9aa2af]" />
            <h2 className="mt-4 text-2xl font-black text-[#111827]">
              Queue is clear
            </h2>
            <p className="mt-2 text-sm text-[#7b8493]">
              No submissions match the current view.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((request) => {
              const config = statusConfig[request.status];
              const Icon = config.icon;
              return (
                <Link
                  key={request._id}
                  to={`/requests/${request._id}`}
                  className="paper-card group grid gap-4 rounded-[24px] p-4 transition hover:-translate-y-0.5 hover:shadow-xl sm:grid-cols-[64px_1fr_auto] sm:items-center sm:p-5"
                >
                  <div className="h-20 w-14 overflow-hidden rounded-xl bg-[#111827]">
                    {request.coverImage ? (
                      <img
                        src={request.coverImage}
                        alt=""
                        className="h-full w-full bg-white object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/40">
                        <FileSearch className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-black text-[#111827] group-hover:text-[#7557d9]">
                      {request.title}
                    </div>
                    <div className="mt-1 text-sm text-[#667085]">
                      {request.author} · {request.category} · {request.year}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-[#9aa2af]">
                      Submitted by{" "}
                      {request.requesterUsername || request.requesterEmail}
                    </div>
                  </div>
                  <div
                    className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${config.className}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {config.label}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
