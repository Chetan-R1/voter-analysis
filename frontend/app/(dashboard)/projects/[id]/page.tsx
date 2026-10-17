import { Suspense } from "react";
import ProjectPageClient from "./ProjectPageClient";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
      </div>
    }>
      <ProjectPageClient params={params} />
    </Suspense>
  );
}
