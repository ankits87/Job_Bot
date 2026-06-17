import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

interface Application {
  id: number;
  job: { title: string; company: string; location: string; url: string; is_easy_apply: boolean };
  status: "pending" | "applying" | "applied" | "failed" | "manual_required";
  ats_score_before: number;
  ats_score_after: number;
  applied_at: string | null;
  error_message: string | null;
}

const STATUS_META: Record<Application["status"], { label: string; color: string; icon: string }> = {
  pending:         { label: "Queued",           color: "text-gray-400 bg-gray-800 border-gray-700",          icon: "⏳" },
  applying:        { label: "Applying…",        color: "text-blue-400 bg-blue-900/30 border-blue-700",        icon: "🔄" },
  applied:         { label: "Applied",          color: "text-green-400 bg-green-900/30 border-green-700",     icon: "✅" },
  failed:          { label: "Failed",           color: "text-red-400 bg-red-900/30 border-red-700",           icon: "❌" },
  manual_required: { label: "Manual Required",  color: "text-yellow-400 bg-yellow-900/30 border-yellow-700",  icon: "⚠️" },
};

export default function ApplicationStatus() {
  const queryClient = useQueryClient();

  const markApplied = useMutation({
    mutationFn: (id: number) => api.post(`/applications/${id}/mark-applied`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: async () => (await api.get("/applications")).data,
    refetchInterval: (query) => {
      const data = query.state.data as Application[] | undefined;
      const hasActive = data?.some((a) => a.status === "applying" || a.status === "pending");
      return hasActive ? 3000 : false;
    },
  });

  const counts = applications.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-gray-400 text-sm mt-1">Live status of all submitted applications</p>
        </div>
        <a href="/jobs" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          + Find more jobs
        </a>
      </div>

      {/* Summary bar */}
      {applications.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(["applied", "applying", "pending", "failed"] as Application["status"][]).map((s) => (
            <div key={s} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{counts[s] ?? 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">{STATUS_META[s].label}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-900 border border-gray-800 animate-pulse" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">📭</p>
          <p className="text-gray-400">No applications yet. <a href="/jobs" className="text-blue-400 hover:underline">Find jobs to apply to.</a></p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const meta = STATUS_META[app.status];
            return (
              <div key={app.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
                <span className="text-xl shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{app.job.title}</p>
                  <p className="text-gray-400 text-sm">{app.job.company} · {app.job.location}</p>
                  {app.error_message && (
                    <p className="text-red-400 text-xs mt-1">{app.error_message}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500">ATS</p>
                    <p className="text-sm">
                      <span className="text-gray-500">{Math.round(app.ats_score_before * 100)}%</span>
                      <span className="text-gray-600 mx-1">→</span>
                      <span className="text-green-400 font-semibold">{Math.round(app.ats_score_after * 100)}%</span>
                    </p>
                  </div>
                  <span className={`text-xs border px-3 py-1 rounded-full font-medium ${meta.color}`}>
                    {meta.label}
                  </span>
                  {app.status === "manual_required" || app.status === "failed" ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <a href={app.job.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                        Apply manually →
                      </a>
                      {app.status === "manual_required" && (
                        <button
                          onClick={() => markApplied.mutate(app.id)}
                          disabled={markApplied.isPending}
                          className="text-xs bg-green-900/40 border border-green-700 text-green-400 hover:bg-green-800/50 disabled:opacity-50 px-3 py-1 rounded-full transition-colors whitespace-nowrap"
                        >
                          {markApplied.isPending ? "Saving…" : "Mark as Applied"}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
