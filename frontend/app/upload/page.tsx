"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { me } from "@/lib/api";
import api from "@/lib/api";
import Navbar from "../components/Navbar";

interface ImportRecord {
  id: number;
  file_name: string;
  status: "uploaded" | "processing" | "done" | "review" | "failed";
  total_voters: number | null;
  issues: number;
  imported_at: string | null;
  ward: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  uploaded:   "bg-gray-100 text-gray-600",
  processing: "bg-yellow-100 text-yellow-700",
  done:       "bg-green-100 text-green-700",
  review:     "bg-orange-100 text-orange-700",
  failed:     "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  uploaded:   "Queued",
  processing: "Processing…",
  done:       "Done ✓",
  review:     "Done (issues)",
  failed:     "Failed ✗",
};

export default function UploadPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [messages, setMessages] = useState<{ text: string; ok: boolean }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    me().then((u) => setEmail(u.email)).catch(() => router.replace("/login"));
    fetchImports();
  }, [router]);

  // Poll while any import is processing
  useEffect(() => {
    const hasActive = imports.some((i) => i.status === "processing" || i.status === "uploaded");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(fetchImports, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [imports]);

  async function fetchImports() {
    try {
      const { data } = await api.get<ImportRecord[]>("/imports");
      setImports(data);
    } catch {}
  }

  async function uploadFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      addMessage("Only PDF files are allowed", false);
      return;
    }
    setUploading(true);
    for (const file of pdfs) {
      const form = new FormData();
      form.append("file", file);
      try {
        const { data } = await api.post("/imports/upload", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        addMessage(
          data.skipped
            ? `${file.name} — already uploaded`
            : `${file.name} — upload successful, processing started`,
          true
        );
      } catch (e: any) {
        addMessage(`${file.name} — ${e?.response?.data?.detail ?? "upload failed"}`, false);
      }
    }
    setUploading(false);
    fetchImports();
  }

  function addMessage(text: string, ok: boolean) {
    setMessages((prev) => [{ text, ok }, ...prev].slice(0, 10));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar email={email} />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Search
        </Link>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
            ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"}`}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-indigo-600 font-medium">Uploading…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Ward PDF files yahan drop karein</p>
                <p className="text-sm text-gray-400 mt-0.5">ya click karke select karein · Multiple files ek saath</p>
              </div>
              <span className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-medium">
                PDF only
              </span>
            </div>
          )}
        </div>

        {/* Upload messages */}
        {messages.length > 0 && (
          <div className="space-y-1.5">
            {messages.map((m, i) => (
              <div key={i} className={`text-sm rounded-xl px-4 py-2.5 flex items-start gap-2
                ${m.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                <span>{m.ok ? "✓" : "✗"}</span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Import history */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Import History</h3>
            <button onClick={fetchImports} className="text-xs text-indigo-600 hover:underline">Refresh</button>
          </div>

          {imports.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400 text-sm">
              Koi PDF abhi tak upload nahi hua
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {imports.map((imp) => (
                <div key={imp.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{imp.file_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {imp.ward ?? "—"}
                      {imp.total_voters != null && ` · ${imp.total_voters} voters`}
                      {imp.issues > 0 && ` · ${imp.issues} issue${imp.issues > 1 ? "s" : ""}`}
                    </p>
                    {imp.imported_at && (
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(imp.imported_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLE[imp.status]}`}>
                    {imp.status === "processing" ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Processing…
                      </span>
                    ) : STATUS_LABEL[imp.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
