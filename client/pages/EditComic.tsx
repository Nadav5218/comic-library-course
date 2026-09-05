import { DragEvent, FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  UploadCloud,
  X,
} from "lucide-react";
import type { Comic } from "@shared/api";
import { AppHeader } from "@/components/app/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { generatePdfCover } from "@/lib/pdfCover";
import { uploadForm } from "@/lib/upload";

export default function EditComic() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [comic, setComic] = useState<Comic | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !token) return;
    const load = async () => {
      try {
        const response = await fetch(`/api/comics/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.data?.comic) {
          throw new Error(data.error || "Comic not found");
        }
        const value = data.data.comic as Comic;
        setComic(value);
        setTitle(value.title);
        setAuthor(value.author);
        setYear(String(value.year));
        setCategory(value.category);
        setPartName(value.partName || "");
        setPartNumber(value.partNumber == null ? "" : String(value.partNumber));
        setDescription(value.description || "");
        setPreviewUrl(value.coverImage || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load comic");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, token]);

  useEffect(() => {
    if (!cover) return;
    const url = URL.createObjectURL(cover);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const choosePdf = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("The PDF is larger than the 100 MB upload limit.");
      return;
    }
    setPdf(file);
    setProcessing(true);
    try {
      setCover(await generatePdfCover(file));
    } catch {
      setCover(null);
      setError("The new PDF is ready, but its cover could not be generated.");
    } finally {
      setProcessing(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    void choosePdf(event.dataTransfer.files?.[0]);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !token) return;
    setSaving(true);
    setProgress(0);
    setError(null);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("author", author.trim());
      form.append("year", year);
      form.append("category", category.trim());
      form.append("description", description.trim());
      form.append("partName", partName.trim());
      form.append("partNumber", partNumber);
      if (pdf) form.append("pdfFile", pdf);
      if (cover) form.append("coverImage", cover);
      await uploadForm(`/api/comics/${id}`, "PUT", form, token, setProgress);
      navigate(`/comic/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="h-[620px] animate-pulse rounded-[30px] bg-black/5" />
        </div>
      </div>
    );
  }

  if (!comic) {
    return (
      <div className="page-shell min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="text-3xl font-black text-[#111827]">
            Comic unavailable
          </h1>
          <p className="mt-3 text-sm text-[#667085]">
            {error || "The comic could not be loaded."}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-full bg-[#111827] px-5 py-2.5 text-sm font-black text-white"
          >
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell pb-20">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-7 flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#111827]"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={save}
            className="paper-card rounded-[30px] p-6 sm:p-8"
          >
            <div className="mb-8">
              <div className="eyebrow text-[#7557d9]">Administrator edit</div>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#111827]">
                Edit comic
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#667085]">
                Metadata can be changed without replacing the PDF. Drop a new
                PDF only when the document itself needs to change.
              </p>
            </div>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mb-8 flex cursor-pointer items-center gap-4 rounded-[24px] border-2 border-dashed px-5 py-5 transition ${dragging ? "border-[#7557d9] bg-purple-50" : "border-black/15 bg-black/[0.02] hover:border-[#7557d9]/50"}`}
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => void choosePdf(event.target.files?.[0])}
              />
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7557d9] text-white">
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : pdf ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-[#111827]">
                  {pdf ? pdf.name : "Replace PDF"}
                </div>
                <div className="mt-1 text-xs font-semibold text-[#8a93a1]">
                  {pdf
                    ? "A new cover was generated from page one."
                    : "Optional · keep the current file if unchanged"}
                </div>
              </div>
              <UploadCloud className="h-4 w-4 text-[#8a93a1]" />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Title" value={title} onChange={setTitle} required />
              <Field
                label="Author"
                value={author}
                onChange={setAuthor}
                required
              />
              <Field
                label="Year"
                value={year}
                onChange={setYear}
                type="number"
                required
              />
              <Field
                label="Series / category"
                value={category}
                onChange={setCategory}
                required
              />
              <Field
                label="Arc / section"
                value={partName}
                onChange={setPartName}
                placeholder="Optional"
              />
              <Field
                label="Part number"
                value={partNumber}
                onChange={setPartNumber}
                type="number"
                min={1}
                placeholder="Optional"
              />
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
                rows={5}
                className="focus-ring w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-6"
              />
            </label>

            {error && (
              <div className="mt-5 flex items-start justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {saving && (
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                  <span>Saving changes</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/8">
                  <div
                    className="h-full bg-[#7557d9] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={saving || processing}
                className="flex items-center gap-2 rounded-full bg-[#7557d9] px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />{" "}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="ink-card rounded-[30px] p-5">
              <div className="eyebrow text-[#e8a838]">Current cover</div>
              <div className="mt-4 aspect-[2/3] overflow-hidden rounded-[22px] border border-white/10 bg-white/5">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Comic cover"
                    className="h-full w-full bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-8 text-center text-white/40">
                    <FileText className="h-10 w-10" />
                    <p className="mt-4 text-sm font-bold leading-6">
                      No permanent cover is stored yet. Replacing the PDF will
                      create one automatically.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-5 text-xs leading-5 text-white/45">
                The private PDF itself is never exposed by the public catalog
                API.
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        required={required}
        placeholder={placeholder}
        min={min}
        className="focus-ring h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold"
      />
    </label>
  );
}
