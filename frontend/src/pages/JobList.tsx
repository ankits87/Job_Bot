import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import JobCard from "../components/JobCard";

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  jd_text: string;
  url: string;
  is_easy_apply: boolean;
  relevance_score: number;
  scraped_at: string | null;
  posted_at: string | null;
  ats_score_before?: number;
  ats_score_after?: number;
}

type SortMode = "relevant" | "latest";

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function lastUpdatedLabel(jobs: Job[]): string {
  if (!jobs.length) return "";
  const latest = jobs.reduce((a, b) =>
    (a.scraped_at ?? "") > (b.scraped_at ?? "") ? a : b
  );
  return latest.scraped_at ? formatRelative(latest.scraped_at) : "";
}

function formatPostedAt(posted_at: string | null, scraped_at: string | null): string {
  if (posted_at) return `Posted ${posted_at}`;
  if (scraped_at) return formatRelative(scraped_at);
  return "";
}

export default function JobList() {
  const navigate = useNavigate();
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [search, setSearch]         = useState("");
  const [easyApplyOnly, setEasyApplyOnly] = useState(false);
  const [scanning, setScanning]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sortMode, setSortMode]       = useState<SortMode>("relevant");

  const { data: jobs = [], isLoading, refetch } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => (await api.get("/jobs")).data,
    staleTime: 0,
    gcTime: 0,
  });

  const startCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldownSecs(30);
    cooldownRef.current = setInterval(() => {
      setCooldownSecs((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const startScan = async () => {
    setScanning(true);
    try {
      await api.post("/jobs/scan", {}, { timeout: 180000 });
      await refetch();
      startCooldown();
    } finally {
      setScanning(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      await api.post(`/jobs/scan?quick=true`, {}, { timeout: 120000 });
      await refetch();
      startCooldown();
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleSelect = (id: number) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered = jobs
    .filter((j) => {
      if (easyApplyOnly && !j.is_easy_apply) return false;
      if (search && !j.title.toLowerCase().includes(search.toLowerCase()) &&
          !j.company.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "latest") {
        return (b.scraped_at ?? "").localeCompare(a.scraped_at ?? "");
      }
      return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
    });

  const lastUpdated = lastUpdatedLabel(jobs);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Search</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-400 text-sm">Jobs matched and ranked against your profile</p>
            {lastUpdated && (
              <span className="text-xs text-gray-600">· Last updated {lastUpdated}</span>
            )}
          </div>
        </div>
        <button
          onClick={startScan}
          disabled={scanning || loadingMore || cooldownSecs > 0}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          {scanning ? <span className="animate-spin">⟳</span> : "🔍"}
          {scanning ? "Scanning LinkedIn…" : cooldownSecs > 0 ? `Wait ${cooldownSecs}s` : "Scan Jobs"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Filter by title or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
        <label className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={easyApplyOnly}
            onChange={(e) => setEasyApplyOnly(e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-sm text-gray-300">Easy Apply only</span>
        </label>
        {/* Sort toggle */}
        <div className="flex bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setSortMode("relevant")}
            className={`px-4 py-2 text-sm transition-colors ${
              sortMode === "relevant"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Most Relevant
          </button>
          <button
            onClick={() => setSortMode("latest")}
            className={`px-4 py-2 text-sm transition-colors border-l border-gray-700 ${
              sortMode === "latest"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Latest First
          </button>
        </div>
      </div>

      {/* Job grid */}
      {isLoading || scanning ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-900 border border-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🔍</p>
          <p className="text-gray-400">
            {jobs.length === 0
              ? 'Click "Scan Jobs" to search LinkedIn for matched roles.'
              : "No jobs match your filters."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                selected={selected.has(job.id)}
                onToggle={() => toggleSelect(job.id)}
              />
            ))}
          </div>

          {/* Load more */}
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMore}
              disabled={loadingMore || scanning || cooldownSecs > 0}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 disabled:opacity-50 px-6 py-2.5 rounded-xl transition-colors"
            >
              {loadingMore ? <span className="animate-spin">⟳</span> : "↓"}
              {loadingMore
                ? "Fetching more results…"
                : cooldownSecs > 0
                ? `Wait ${cooldownSecs}s before loading more`
                : "Load more results"}
            </button>
          </div>
        </>
      )}

      {/* Sticky apply bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-gray-900 border border-blue-600 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-2xl shadow-blue-900/30">
            <span className="text-sm text-gray-300">
              <span className="text-blue-400 font-bold">{selected.size}</span> job{selected.size !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={() => navigate("/confirm", { state: { jobIds: [...selected] } })}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              Review & Apply →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
