import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Save,
  XCircle,
} from "lucide-react";
import { Document, Page as PdfPage, pdfjs } from "react-pdf";
import pdfWorker from "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ComicRequest } from "@shared/api";
import { AppHeader } from "@/components/app/AppHeader";
import { useAuth } from "@/hooks/useAuth";
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

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function AdminRequestReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [request, setRequest] = useState<ComicRequest | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const applyRequest = (value: ComicRequest) => {
    setRequest(value);
    setTitle(value.title);
    setAuthor(value.author);
    setYear(String(value.year));
    setCategory(value.category);
    setPartName(value.partName || "");
    setPartNumber(value.partNumber == null ? "" : String(value.partNumber));
    setDescription(value.description || "");
    setAdminNote(value.adminNote || "");
  };

  useEffect(() => {
    if (!id || !token) return;
    const load = async () => {
      try {
        const response = await fetch(`/api/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.data?.request) {
          throw new Error(data.error || "Submission not found");
        }
        applyRequest(data.data.request);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load submission",
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, token]);

  const payload = () => ({
    title: title.trim(),
    author: author.trim(),
    year: Number(year),
    category: category.trim(),
    description: description.trim(),
    partName: partName.trim() || null,
    partNumber: partNumber ? Number(partNumber) : null,
    adminNote: adminNote.trim() || null,
  });

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!id || !token) return;
    setBusy("save");
    setError(null);
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload()),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Unable to save");
      applyRequest(data.data.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save");
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    if (!id || !token) return;
    setBusy("approve");
    setError(null);
    try {
      const response = await fetch(`/api/requests/${id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload()),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Approval failed");
      navigate("/requests", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!id || !token) return;
    setRejectOpen(false);
    setBusy("reject");
    setError(null);
    try {
      const response = await fetch(`/api/requests/${id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ adminNote: adminNote.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Rejection failed");
      navigate("/requests", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="page-shell min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="h-[700px] animate-pulse rounded-[30px] bg-black/5" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="page-shell min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <FileText className="mx-auto h-10 w-10 text-[#9aa2af]" />
          <h1 className="mt-4 text-3xl font-black text-[#111827]">
            Submission unavailable
          </h1>
          <p className="mt-3 text-sm text-[#667085]">{error}</p>
        </div>
      </div>
    );
  }

  const editable = request.status === "pending";

  return (
    <div className="page-shell pb-20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/requests")}
          className="mb-6 flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#111827]"
        >
          <ArrowLeft className="h-4 w-4" /> Review queue
        </button>

        <div className="grid gap-7 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden rounded-[30px] bg-[#111827] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
              <div>
                <div className="text-sm font-black">Document preview</div>
                <div className="mt-1 text-xs text-white/45">
                  {request.originalFileName || "Submitted PDF"}
                </div>
              </div>
              {numPages > 0 && (
                <div className="flex items-center gap-2 rounded-full bg-white/8 p-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-16 text-center text-xs font-black">
                    {page} / {numPages}
                  </span>
                  <button
                    disabled={page >= numPages}
                    onClick={() =>
                      setPage((value) => Math.min(numPages, value + 1))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex min-h-[680px] items-start justify-center overflow-auto bg-[#0b1120] p-5">
              <Document
                file={request.pdfFile}
                onLoadSuccess={({ numPages: count }) => {
                  setNumPages(count);
                  setPage(1);
                }}
                loading={
                  <div className="pt-20 text-sm font-bold text-white/45">
                    Loading private PDF…
                  </div>
                }
                error={
                  <div className="pt-20 text-sm font-bold text-red-300">
                    Unable to render PDF
                  </div>
                }
              >
                <PdfPage
                  pageNumber={page}
                  width={760}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-2xl"
                />
              </Document>
            </div>
          </section>

          <form
            onSubmit={save}
            className="paper-card rounded-[30px] p-6 sm:p-8 xl:self-start"
          >
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow text-[#7557d9]">Review metadata</div>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#111827]">
                  {request.title}
                </h1>
                <p className="mt-2 text-xs font-semibold text-[#8a93a1]">
                  Submitted by{" "}
                  {request.requesterUsername || request.requesterEmail}
                </p>
                <div className="mt-3 space-y-1 rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-semibold text-[#667085]">
                  <div>{request.requesterEmail}</div>
                  {request.requesterPhone && (
                    <div>{request.requesterPhone}</div>
                  )}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-black ${request.status === "pending" ? "bg-amber-50 text-amber-700" : request.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
              >
                {request.status}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Title"
                value={title}
                onChange={setTitle}
                disabled={!editable}
              />
              <Field
                label="Author"
                value={author}
                onChange={setAuthor}
                disabled={!editable}
              />
              <Field
                label="Year"
                value={year}
                onChange={setYear}
                type="number"
                disabled={!editable}
              />
              <Field
                label="Series"
                value={category}
                onChange={setCategory}
                disabled={!editable}
              />
              <Field
                label="Arc / section"
                value={partName}
                onChange={setPartName}
                disabled={!editable}
              />
              <Field
                label="Part number"
                value={partNumber}
                onChange={setPartNumber}
                type="number"
                min={1}
                disabled={!editable}
              />
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!editable}
                rows={5}
                className="focus-ring w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-6 disabled:bg-black/[0.03]"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                Administrator note to user
              </span>
              <textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                disabled={!editable}
                rows={3}
                maxLength={1200}
                placeholder="Optional. This note will be shown to the user and included in the approval or rejection e-mail."
                className="focus-ring w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-6 disabled:bg-black/[0.03]"
              />
              <div className="mt-1.5 text-xs font-semibold text-[#98a2b3]">
                {adminNote.length} / 1200
              </div>
            </label>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {editable && (
              <div className="mt-7 space-y-3">
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-sm font-black text-[#344054] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />{" "}
                  {busy === "save" ? "Saving…" : "Save metadata"}
                </button>
                <button
                  type="button"
                  onClick={approve}
                  disabled={busy !== null}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2a9d8f] text-sm font-black text-white shadow-lg disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />{" "}
                  {busy === "approve" ? "Publishing…" : "Approve and publish"}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectOpen(true)}
                  disabled={busy !== null}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#e65f5c] text-sm font-black text-white disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />{" "}
                  {busy === "reject" ? "Rejecting…" : "Reject submission"}
                </button>
              </div>
            )}
          </form>
        </div>
      </main>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent className="bg-[#fffdf8]">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this submission?</AlertDialogTitle>
            <AlertDialogDescription>
              The submission will stay in the user’s history as not approved and
              will not be published. The administrator note above will be sent
              to the user as the rejection reason when provided.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void reject()}
              className="bg-[#d04745] text-white hover:bg-[#b93b39]"
            >
              Reject submission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        min={min}
        className="focus-ring h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibolddisabled:bg-black/[0.03]"
      />
    </label>
  );
}
