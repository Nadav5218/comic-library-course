import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";

export default function NotFound() {
  return (
    <div className="page-shell min-h-screen">
      <AppHeader />
      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
        <div className="relative mb-8">
          <div className="absolute -left-12 -top-8 h-28 w-28 rounded-full bg-[#e8a838]/25 blur-2xl" />
          <div className="absolute -right-12 -bottom-8 h-28 w-28 rounded-full bg-[#3157d5]/20 blur-2xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#111827] text-white shadow-2xl">
            <BookOpen className="h-10 w-10" />
          </div>
        </div>
        <div className="eyebrow text-[#e65f5c]">404 · Lost page</div>
        <h1 className="mt-3 text-balance text-5xl font-black tracking-[-0.055em] text-[#111827]">
          This page slipped out of the collection.
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-[#667085]">
          The link may be outdated or the page may have moved. The library
          itself is still right where you left it.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#3157d5] px-6 py-3 text-sm font-black text-white shadow-lg"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the library
        </Link>
      </main>
    </div>
  );
}
