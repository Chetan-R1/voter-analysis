"use client";

import { useRef, useState } from "react";
import type { ImportRecord } from "@/lib/types";
import { presignUpload, registerUpload, uploadPdf, retryImport, deleteImport } from "@/lib/api";
import { useLang } from "@/app/context/LanguageContext";

const STATUS_COLOR: Record<string, string> = {
  uploaded: "text-slate-400", processing: "text-amber-500",
  done: "text-emerald-600", review: "text-orange-500", failed: "text-red-500",
};
const STATUS_DOT: Record<string, string> = {
  uploaded: "bg-slate-300", processing: "bg-amber-400 animate-pulse",
  done: "bg-emerald-500", review: "bg-orange-400", failed: "bg-red-500",
};

interface Props {
  projectId: number;
  imports: ImportRecord[];
  onRefresh: () => void;
}

export default function ImportPanel({ projectId, imports, onRefresh }: Props) {
  const { t } = useLang();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [msgs, setMsgs] = useState<{ text: string; ok: boolean }[]>([]);

  async function handleFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { addMsg(t.upload.pdfOnly, false); return; }
    setUploading(true);
    for (const file of pdfs) {
      try {
        const presign = await presignUpload(projectId, file.name);
        if (presign) {
          const r2res = await fetch(presign.upload_url, {
            method: "PUT", body: file,
            headers: { "Content-Type": "application/pdf" },
          });
          if (!r2res.ok) throw new Error(`R2 upload failed: ${r2res.status}`);
          const reg = await registerUpload(presign.key, file.name, projectId);
          addMsg(reg.skipped ? t.upload.alreadyImported(file.name) : t.upload.uploadOk(file.name), true);
        } else {
          const res = await uploadPdf(projectId, file);
          addMsg(res.skipped ? t.upload.alreadyImported(file.name) : t.upload.uploadOk(file.name), true);
        }
      } catch (e: any) {
        addMsg(`${file.name} — ${e?.response?.data?.detail ?? e?.message ?? "upload failed"}`, false);
      }
    }
    setUploading(false);
    onRefresh();
  }

  function addMsg(text: string, ok: boolean) {
    setMsgs((p) => [{ text, ok }, ...p].slice(0, 5));
  }

  const processingCount = imports.filter((i) => i.status === "processing" || i.status === "uploaded").length;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && fileInput.current?.click()}
        className={`rounded-xl border-2 border-dashed transition-all cursor-pointer py-6 px-4 text-center
          ${dragOver ? "border-indigo-400 bg-indigo-50"
          : uploading ? "border-indigo-300 bg-indigo-50/50 cursor-wait"
          : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"}`}
      >
        <input ref={fileInput} type="file" accept=".pdf" multiple className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
            <p className="text-xs text-indigo-600 font-medium">{t.upload.uploading}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xs font-semibold text-slate-500">{t.upload.dropTitle}</p>
          </div>
        )}
      </div>

      {/* Feedback messages */}
      {msgs.map((m, i) => (
        <div key={i} className={`text-xs rounded-lg px-3 py-2 flex items-start gap-1.5
          ${m.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          <span className="font-bold shrink-0">{m.ok ? "✓" : "✗"}</span>
          <span>{m.text}</span>
        </div>
      ))}

      {/* Import list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t.upload.historyTitle}</span>
          {processingCount > 0 && (
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              {t.upload.processingN(processingCount)}
            </span>
          )}
        </div>
        {imports.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">{t.upload.noImports}</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {imports.map((imp) => (
              <li key={imp.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 truncate max-w-[140px]">{imp.file_name}</p>
                  <div className={`flex items-center gap-1 text-xs font-medium shrink-0 ${STATUS_COLOR[imp.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[imp.status]}`} />
                    {(t.upload as any)[`status${imp.status.charAt(0).toUpperCase() + imp.status.slice(1)}`] ?? imp.status}
                  </div>
                </div>
                {imp.total_voters != null && (
                  <p className="text-xs text-slate-400 mt-0.5">{imp.total_voters} voters</p>
                )}
                {(imp.status === "failed" || imp.status === "review") && (
                  <div className="flex gap-3 mt-1.5">
                    <button
                      onClick={async () => { await retryImport(imp.id); onRefresh(); }}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >Retry</button>
                    {imp.status === "failed" && (
                      <button
                        onClick={async () => { await deleteImport(imp.id); onRefresh(); }}
                        className="text-xs text-red-400 hover:underline font-medium"
                      >Delete</button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
