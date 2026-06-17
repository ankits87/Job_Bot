import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";

interface Connection {
  name: string;
  title: string;
  profile_url: string;
  degree: number;
  outreach_message: string;
}

interface ConnectionsData {
  company: string;
  job_title: string;
  connections: Connection[];
}

function degreeBadge(degree: number) {
  const styles: Record<number, string> = {
    1: "bg-green-900/40 border-green-700 text-green-300",
    2: "bg-blue-900/40 border-blue-700 text-blue-300",
    3: "bg-gray-800 border-gray-700 text-gray-400",
  };
  return (
    <span className={`text-xs border px-2 py-0.5 rounded-full ${styles[degree] ?? styles[3]}`}>
      {degree === 1 ? "1st" : degree === 2 ? "2nd" : "3rd"} degree
    </span>
  );
}

function ConnectionCard({ conn }: { conn: Connection }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(conn.outreach_message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      {/* Person header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-white font-semibold">{conn.name}</p>
          <p className="text-gray-400 text-sm">{conn.title}</p>
          {degreeBadge(conn.degree)}
        </div>
        {conn.profile_url && (
          <a
            href={conn.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            View on LinkedIn →
          </a>
        )}
      </div>

      {/* Outreach message */}
      {conn.outreach_message && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Outreach message</p>
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{conn.outreach_message}</p>
          </div>
          <button
            onClick={copy}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition-colors"
          >
            {copied ? "✓ Copied!" : "Copy message"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Connections() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<ConnectionsData>({
    queryKey: ["connections", jobId],
    queryFn: async () => (await api.get(`/network/connections/${jobId}`)).data,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Connections</h1>
          {data && (
            <p className="text-gray-400 text-sm mt-0.5">
              {data.connections.length} connection{data.connections.length !== 1 ? "s" : ""} at{" "}
              <span className="text-white font-medium">{data.company}</span>
              {" "}for <span className="text-gray-300">{data.job_title}</span>
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-900 border border-gray-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">⚠️</p>
          <p className="text-gray-400">
            {(error as any)?.response?.status === 503
              ? "LinkedIn session not found. Save your LinkedIn session from the Jobs page first."
              : "Failed to fetch connections. Make sure your LinkedIn session is active."}
          </p>
        </div>
      ) : data?.connections.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🔍</p>
          <p className="text-gray-400">No connections found at {data.company}.</p>
          <p className="text-gray-600 text-sm">Try again after expanding your LinkedIn network.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Degree legend */}
          <div className="flex gap-3 flex-wrap text-xs text-gray-500">
            <span>Sorted by closeness:</span>
            <span className="text-green-400">1st degree — direct connections</span>
            <span className="text-blue-400">2nd degree — mutual connections</span>
            <span className="text-gray-400">3rd degree — extended network</span>
          </div>

          {data?.connections.map((conn, i) => (
            <ConnectionCard key={i} conn={conn} />
          ))}
        </div>
      )}
    </div>
  );
}
