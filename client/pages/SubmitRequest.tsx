import { DragEvent, FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  UploadCloud,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { generatePdfCover } from "@/lib/pdfCover";
import { uploadForm } from "@/lib/upload";

export default function SubmitRequest() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [category, setCategory] = useState("");
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/comics/categories")
      .then((response) => response.json())
      .then((data) => setCategories(data.data?.categories || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!cover) {
      setCoverUrl(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverUrl(url);
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
      setError("The PDF is ready, but its cover preview could not be created.");
    } finally {
      setProcessing(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    void choosePdf(event.dataTransfer.files?.[0]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !pdf) {
      setError("Choose a PDF before submitting.");
      return;
    }
    setUploading(true);
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
      form.append("pdfFile", pdf);
      if (cover) form.append("coverImage", cover);
      await uploadForm("/api/requests", "POST", form, token, setProgress);
      navigate("/my-requests", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-shell pb-20">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-[#667085] hover:text-[#111827]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to library
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <form
            onSubmit={submit}
            className="paper-card rounded-[30px] p-6 sm:p-8"
          >
            <div className="mb-8">
              <div className="eyebrow text-[#3157d5]">Reader submission</div>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#111827]">
                Submit a comic
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">
                Send a private PDF to the review queue. An administrator can
                approve it without asking you to upload it again.
              </p>
            </div>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mb-8 flex cursor-pointer flex-col items-center justify-center rounded-[26px] border-2 border-dashed px-6 py-10 text-center transition ${dragging ? "border-[#3157d5] bg-blue-50" : "border-black/15 bg-black/[0.02] hover:border-[#3157d5]/60"}`}
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => void choosePdf(event.target.files?.[0])}
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3157d5] text-white shadow-lg">
                {processing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
              </div>
              <div className="mt-4 max-w-full truncate text-base font-black text-[#111827]">
                {pdf ? pdf.name : "Drop a PDF here or click to browse"}
              </div>
              <div className="mt-1 text-xs font-semibold text-[#8a93a1]">
                PDF only · up to 100 MB
              </div>
              {pdf && !processing && (
                <div className="mt-4 flex items-center gap-2 text-xs font-extrabold text-[#2a9d8f]">
                  <CheckCircle2 className="h-4 w-4" /> Ready for review
                </div>
              )}
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
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                  Series / category
                </span>
                <input
                  list="request-categories"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  required
                  maxLength={100}
                  className="focus-ring h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold"
                />
                <datalist id="request-categories">
                  {categories.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
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

            {uploading && (
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                  <span>Sending privately</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/8">
                  <div
                    className="h-full bg-[#3157d5] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={uploading || processing || !pdf}
                className="flex items-center gap-2 rounded-full bg-[#3157d5] px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {uploading ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </form>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="ink-card rounded-[30px] p-5">
              <div className="eyebrow text-[#e8a838]">Page-one cover</div>
              <div className="mt-4 aspect-[2/3] overflow-hidden rounded-[22px] border border-white/10 bg-white/5">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Generated cover"
                    className="h-full w-full bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-7 text-center text-white/40">
                    <FileText className="h-9 w-9" />
                    <p className="mt-4 text-sm font-bold leading-6">
                      The first page becomes the catalog cover automatically.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-5 rounded-2xl bg-white/5 p-4 text-xs leading-5 text-white/50">
                The document remains private. Reviewers receive temporary access
                through the backend.
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
