import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import type { ComicRequest } from "@shared/api";
import { AppHeader } from "@/components/app/AppHeader";
import { useAuth } from "@/hooks/useAuth";

const statusStyle = {
  pending: {
    label: "Pending review",
    icon: Clock3,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Not approved",
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export default function MyRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<ComicRequest[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const response = await fetch("/api/requests/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.error || "Unable to load submissions");
        setRequests(data.data?.requests || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load submissions",
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((request) =>
      [
        request.title,
        request.author,
        request.category,
        request.status,
        request.adminNote || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [requests, query]);

  return (
    <div className="page-shell pb-20">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow text-[#3157d5]">Reader submissions</div>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#111827]">
              My submissions
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">
              Track what you sent, see the review status and open approved
              titles directly.
            </p>
          </div>
          <Link
            to="/submit-request"
            className="flex items-center gap-2 rounded-full bg-[#3157d5] px-5 py-3 text-sm font-black text-white shadow-lg"
          >
            <Plus className="h-4 w-4" /> New submission
          </Link>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {(["pending", "approved", "rejected"] as const).map((status) => {
            const config = statusStyle[status];
            const Icon = config.icon;
            return (
              <div key={status} className="paper-card rounded-[24px] p-5">
                <Icon className="h-5 w-5 text-[#667085]" />
                <div className="mt-5 text-3xl font-black text-[#111827]">
                  {requests.filter((item) => item.status === status).length}
                </div>
                <div className="mt-1 text-xs font-black uppercase tracking-[0.11em] text-[#8a93a1]">
                  {config.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a93a1]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search submissions"
            className="focus-ring h-12 w-full rounded-full border border-black/10 bg-white/75 pl-11 pr-4 text-sm font-semibold"
          />
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-[22px] bg-black/5"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="paper-card rounded-[30px] px-6 py-16 text-center">
            <FileText className="mx-auto h-9 w-9 text-[#9aa2af]" />
            <h2 className="mt-4 text-2xl font-black text-[#111827]">
              No submissions here
            </h2>
            <p className="mt-2 text-sm text-[#7b8493]">
              Submit a PDF and its review status will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((request) => {
              const config = statusStyle[request.status];
              const Icon = config.icon;
              const destination =
                request.status === "approved" && request.approvedComicId
                  ? `/comic/${request.approvedComicId}`
                  : null;
              const content = (
                <>
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-[#111827]">
                    {request.coverImage ? (
                      <img
                        src={request.coverImage}
                        alt=""
                        className="h-full w-full bg-white object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/40">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-black text-[#111827] group-hover:text-[#3157d5]">
                      {request.title}
                    </div>
                    <div className="mt-1 text-sm text-[#667085]">
                      {request.author} · {request.category} · {request.year}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-[#9aa2af]">
                      Submitted{" "}
                      {request.createdAt
                        ? new Date(request.createdAt).toLocaleDateString()
                        : "recently"}
                    </div>
                    {request.status !== "pending" && request.adminNote && (
                      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold leading-5 ${request.status === "rejected" ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
                        <span className="font-black">Administrator note:</span>{" "}
                        {request.adminNote}
                      </div>
                    )}
                  </div>
                  <div
                    className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${config.className}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {config.label}
                  </div>
                </>
              );
              return destination ? (
                <Link
                  key={request._id}
                  to={destination}
                  className="paper-card group flex flex-col gap-4 rounded-[24px] p-4 transition hover:-translate-y-0.5 hover:shadow-xl sm:flex-row sm:items-center sm:p-5"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={request._id}
                  className="paper-card group flex flex-col gap-4 rounded-[24px] p-4 sm:flex-row sm:items-center sm:p-5"
                >
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
