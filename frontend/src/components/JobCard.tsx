import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import type { Job } from "../pages/JobList";

function formatRelative(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

interface Props {
  job: Job;
  selected: boolean;
  onToggle: () => void;
}

interface MatchAnalysis {
  matched: string[];
  missing: string[];
}

export default function JobCard({ job, selected, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { data: analysis, isFetching: analysisLoading } = useQuery<MatchAnalysis>({
    queryKey: ["match-analysis", job.id],
    queryFn: async () => (await api.get(`/jobs/${job.id}/match-analysis`)).data,
    enabled: expanded,
    staleTime: Infinity,
  });

  return (
    <div className={`bg-gray-900 border rounded-2xl transition-all
      ${selected ? "border-blue-500 ring-1 ring-blue-500 bg-blue-950/20" : "border-gray-800 hover:border-gray-700"}`}
    >
      {/* Main row */}
      <div onClick={onToggle} className="relative p-5 cursor-pointer">
        <div className={`absolute top-4 right-4 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
          ${selected ? "bg-blue-500 border-blue-500" : "border-gray-600"}`}>
          {selected && <span className="text-white text-xs font-bold">✓</span>}
        </div>

        <div className="pr-8 space-y-2">
          <div>
            <h3 className="text-white font-semibold">{job.title}</h3>
            <p className="text-gray-400 text-sm">{job.company} · {job.location}</p>
            {(job.posted_at || job.scraped_at) && (
              <p className="text-gray-600 text-xs mt-0.5">
                {job.posted_at
                  ? `Posted ${job.posted_at}`
                  : `Fetched ${formatRelative(job.scraped_at!)}`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <ScoreBadge label="Relevance" value={job.relevance_score} color="purple" />
            {job.ats_score_before != null && (
              <ScoreBadge label="ATS (before)" value={job.ats_score_before} color="gray" />
            )}
            {job.ats_score_after != null && (
              <ScoreBadge label="ATS (after)" value={job.ats_score_after} color="green" />
            )}
            {job.is_easy_apply && (
              <span className="text-xs bg-blue-900/40 border border-blue-700 text-blue-300 px-2.5 py-0.5 rounded-full">
                ⚡ Easy Apply
              </span>
            )}
          </div>

          {!expanded && (
            <p className="text-gray-500 text-xs line-clamp-2">{job.jd_text}</p>
          )}
        </div>
      </div>

      {/* Expand / collapse */}
      {job.jd_text && (
        <div className="border-t border-gray-800">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="w-full text-xs text-gray-500 hover:text-gray-300 py-2 px-5 text-left transition-colors"
          >
            {expanded ? "▲ Hide details" : "▼ View job description & match analysis"}
          </button>

          {expanded && (
            <div className="px-5 pb-5 space-y-5">

              {/* Match Analysis */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Resume Match Analysis</p>
                {analysisLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="animate-spin">⟳</span> Analysing your resume against this JD…
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
                      ) : (
                        <p className="text-xs text-gray-600">None detected</p>
                      )}
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
                      ) : (
                        <p className="text-xs text-gray-600">None detected</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Full JD */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Job Description</p>
                <div className="max-h-64 overflow-y-auto pr-1">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{job.jd_text}</p>
                </div>
              </div>

              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View on LinkedIn →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ label, value, color }: { label: string; value: number; color: "purple" | "gray" | "green" }) {
  const pct = Math.round(value * 100);
  const styles = {
    purple: "bg-purple-900/40 border-purple-700 text-purple-300",
    gray: "bg-gray-800 border-gray-700 text-gray-400",
    green: "bg-green-900/40 border-green-700 text-green-300",
  }[color];
  return (
    <span className={`text-xs border px-2.5 py-0.5 rounded-full ${styles}`}>
      {label}: <strong>{pct}%</strong>
    </span>
  );
}
