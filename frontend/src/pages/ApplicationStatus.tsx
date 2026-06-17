import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

interface Application {
  id: number;
  job: { title: string; company: string; location: string; url: string };
  status: "pending" | "applying" | "applied" | "failed" | "manual_required";
  ats_score_before: number;
  ats_score_after: number;
  applied_at: string | null;
}

export default function ApplicationStatus() {
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: async () => (await api.get("/applications")).data,
  });

  const markApplied = useMutation({
    mutationFn: (id: number) => api.post(`/applications/${id}/mark-applied`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const applied    = applications.filter((a) => a.status === "applied");
  const notYet     = applications.filter((a) => a.status !== "applied");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-gray-400 text-sm mt-1">Track jobs you've applied to on LinkedIn</p>
        </div>
        <a href="/jobs" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          + Find more jobs
        </a>
      </div>

      {applications.length > 0 && (
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{applied.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Applied</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{notYet.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">To Apply</p>
          </div>
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
          {[...notYet, ...applied].map((app) => {
            const isApplied = app.status === "applied";
            return (
              <div key={app.id} className={`bg-gray-900 border rounded-2xl p-5 flex items-center gap-4 transition-colors ${isApplied ? "border-green-900" : "border-gray-800"}`}>
                <span className="text-xl shrink-0">{isApplied ? "✅" : "📋"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{app.job.title}</p>
                  <p className="text-gray-400 text-sm">{app.job.company} · {app.job.location}</p>
                  {app.applied_at && (
                    <p className="text-gray-600 text-xs mt-0.5">Applied {new Date(app.applied_at).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500">ATS score</p>
                    <p className="text-sm">
                      <span className="text-gray-500">{Math.round(app.ats_score_before * 100)}%</span>
                      <span className="text-gray-600 mx-1">→</span>
                      <span className="text-green-400 font-semibold">{Math.round(app.ats_score_after * 100)}%</span>
                    </p>
                  </div>
                  {isApplied ? (
                    <span className="text-xs border px-3 py-1 rounded-full font-medium text-green-400 bg-green-900/30 border-green-700">
                      Applied
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <a
                        href={app.job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                      >
                        Apply on LinkedIn ↗
                      </a>
                      <button
                        onClick={() => markApplied.mutate(app.id)}
                        disabled={markApplied.isPending}
                        className="text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                      >
                        Mark applied
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
