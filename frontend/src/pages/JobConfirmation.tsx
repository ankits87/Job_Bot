import { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import type { Job } from "./JobList";

interface MatchAnalysis {
  matched: string[];
  missing: string[];
}

function useMatchAnalysis(jobId: number, enabled: boolean) {
  return useQuery<MatchAnalysis>({
    queryKey: ["match-analysis", jobId],
    queryFn: async () => (await api.get(`/jobs/${jobId}/match-analysis`)).data,
    enabled,
    staleTime: Infinity,
  });
}

interface OptimizedJob extends Job {
  ats_score_before: number;
  ats_score_after: number;
  keywords: string[];
  optimized_resume_preview: string;
}

export default function JobConfirmation() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const jobIds: number[] = state?.jobIds ?? [];
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: jobs = [], isLoading } = useQuery<OptimizedJob[]>({
    queryKey: ["confirm-jobs", jobIds],
    queryFn: async () => (await api.post("/resume/optimize-batch", { job_ids: jobIds })).data,
    enabled: jobIds.length > 0,
  });

  if (!jobIds.length) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-4xl">🤔</p>
        <p className="text-gray-400">No jobs selected. <a href="/jobs" className="text-blue-400 hover:underline">Go pick some.</a></p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Review & Apply</h1>
        <p className="text-gray-400 text-sm mt-1">
          Your resume has been optimized for each job. Download it, then click Apply on LinkedIn.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {jobIds.map((id) => (
            <div key={id} className="h-28 rounded-2xl bg-gray-900 border border-gray-800 animate-pulse" />
          ))}
          <p className="text-center text-sm text-gray-500 animate-pulse">Optimizing resumes with AI…</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Header row */}
              <div className="p-5 flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{job.title}</h3>
                  <p className="text-gray-400 text-sm">{job.company} · {job.location}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <ScoreComparison before={job.ats_score_before} after={job.ats_score_after} />
                  <button
                    onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                  >
                    {expanded === job.id ? "▲ Close" : "▼ Details"}
                  </button>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Apply on LinkedIn ↗
                  </a>
                </div>
              </div>

              {expanded === job.id && <JobExpandedSection job={job} />}
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="flex justify-start pt-2">
          <button onClick={() => navigate("/jobs")} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← Back to Jobs
          </button>
        </div>
      )}
    </div>
  );
}

type PanelTab = "jd" | "resume" | null;

function JobExpandedSection({ job }: { job: OptimizedJob }) {
  const [activeTab, setActiveTab] = useState<PanelTab>(null);
  const [dlDocx, setDlDocx] = useState(false);
  const [dlPdf, setDlPdf]   = useState(false);

  const { data: analysis, isFetching: analysisFetching } = useMatchAnalysis(job.id, activeTab === "jd");

  const download = useCallback(async (format: "docx" | "pdf", setter: (v: boolean) => void) => {
    setter(true);
    try {
      const endpoint = format === "docx" ? `/resume/download/${job.id}` : `/resume/download-pdf/${job.id}`;
      const res = await api.get(endpoint, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `resume_${job.title.replace(/\s+/g, "_")}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setter(false);
    }
  }, [job.id, job.title]);

  const toggle = (tab: PanelTab) => setActiveTab(prev => prev === tab ? null : tab);

  return (
    <div className="border-t border-gray-800">
      <div className="flex items-center gap-0 divide-x divide-gray-800 border-b border-gray-800">
        <TabButton label="View job details" active={activeTab === "jd"} onClick={() => toggle("jd")} />
        <TabButton label="Download resume" active={activeTab === "resume"} onClick={() => toggle("resume")} />
      </div>

      {activeTab === "jd" && (
        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Resume Match Analysis</p>
            {analysisFetching ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="animate-spin inline-block">⟳</span> Analysing…
              </div>
            ) : analysis ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-green-400">✅ In your resume</p>
                  {analysis.matched.length > 0 ? (
                    <ul className="space-y-1">
                      {analysis.matched.map((item) => (
                        <li key={item} className="text-xs text-gray-300 flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5 shrink-0">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-gray-600">None detected</p>}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-red-400">❌ Missing from resume</p>
                  {analysis.missing.length > 0 ? (
                    <ul className="space-y-1">
                      {analysis.missing.map((item) => (
                        <li key={item} className="text-xs text-gray-300 flex items-start gap-1.5">
                          <span className="text-red-500 mt-0.5 shrink-0">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-gray-600">None detected</p>}
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Job Description</p>
            <div className="max-h-64 overflow-y-auto pr-1">
              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{job.jd_text}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "resume" && (
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500 mb-3">
            Resume optimized for this job's ATS keywords. Download and upload when applying on LinkedIn.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => download("docx", setDlDocx)}
              disabled={dlDocx}
              className="flex items-center gap-2 text-sm bg-blue-900/40 border border-blue-700 text-blue-300 hover:bg-blue-800/50 disabled:opacity-50 px-4 py-2 rounded-xl transition-colors"
            >
              {dlDocx ? "Generating…" : "↓ Download DOCX"}
              {!dlDocx && <span className="text-xs text-blue-500">with highlights</span>}
            </button>
            <button
              onClick={() => download("pdf", setDlPdf)}
              disabled={dlPdf}
              className="flex items-center gap-2 text-sm bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 disabled:opacity-50 px-4 py-2 rounded-xl transition-colors"
            >
              {dlPdf ? "Generating…" : "↓ Download PDF"}
              {!dlPdf && <span className="text-xs text-gray-500">clean for submission</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs py-2.5 px-4 transition-colors font-medium
        ${active ? "text-blue-400 bg-blue-950/30" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"}`}
    >
      {label} {active ? "▲" : "▼"}
    </button>
  );
}

function ScoreComparison({ before, after }: { before: number; after: number }) {
  const b = Math.round(before * 100);
  const a = Math.round(after * 100);
  const delta = a - b;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">{b}%</span>
      <span className="text-gray-600">→</span>
      <span className="text-green-400 font-semibold">{a}%</span>
      {delta > 0 && (
        <span className="text-xs bg-green-900/40 border border-green-800 text-green-400 px-2 py-0.5 rounded-full">
          +{delta}%
        </span>
      )}
    </div>
  );
}
