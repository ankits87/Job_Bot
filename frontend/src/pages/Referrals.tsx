import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";

interface Connection {
  id: number;
  name: string;
  title: string;
  company: string;
  profile_url: string;
  degree: 1 | 2 | 3;
  outreach_message: string;
}

const DEGREE_META = {
  1: { label: "1st", color: "text-green-400 bg-green-900/30 border-green-700", tip: "Direct connection" },
  2: { label: "2nd", color: "text-blue-400 bg-blue-900/30 border-blue-700",   tip: "Connection of a connection" },
  3: { label: "3rd", color: "text-gray-400 bg-gray-800 border-gray-700",      tip: "3 degrees away" },
};

export default function Referrals() {
  const { company } = useParams<{ company: string }>();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const { data: connections = [], isLoading } = useQuery<Connection[]>({
    queryKey: ["referrals", company],
    queryFn: async () => (await api.get(`/network/referrals/${encodeURIComponent(company!)}`)).data,
    enabled: !!company,
  });

  const copyMessage = (id: number, message: string) => {
    navigator.clipboard.writeText(message);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const byDegree = [1, 2, 3].map((d) => ({
    degree: d as 1 | 2 | 3,
    items: connections.filter((c) => c.degree === d),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Referral Network</h1>
        <p className="text-gray-400 text-sm mt-1">
          People at <span className="text-white font-medium">{company}</span> who can refer you, ranked by closeness.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((d) => (
            <div key={d} className="space-y-3">
              <div className="h-4 w-24 rounded bg-gray-800 animate-pulse" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-gray-900 border border-gray-800 animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🔭</p>
          <p className="text-gray-400">No connections found at {company} within 3 degrees.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {byDegree.map(({ degree, items }) => {
            if (items.length === 0) return null;
            const meta = DEGREE_META[degree];
            return (
              <section key={degree} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold border px-2.5 py-0.5 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-sm text-gray-400">{meta.tip} · {items.length} person{items.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="space-y-3">
                  {items.map((c) => (
                    <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                      <div className="p-4 flex items-center gap-4">
                        {/* Avatar placeholder */}
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-semibold shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{c.name}</p>
                          <p className="text-gray-400 text-sm truncate">{c.title}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {expandedId === c.id ? "Hide message" : "View message"}
                          </button>
                          <a
                            href={c.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Connect
                          </a>
                        </div>
                      </div>

                      {expandedId === c.id && (
                        <div className="border-t border-gray-800 p-4 space-y-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI-drafted outreach message</p>
                          <div className="bg-gray-950 rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap">
                            {c.outreach_message}
                          </div>
                          <button
                            onClick={() => copyMessage(c.id, c.outreach_message)}
                            className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
                          >
                            {copied === c.id ? "✓ Copied!" : "📋 Copy to clipboard"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
