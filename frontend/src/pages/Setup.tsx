import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const BACKEND = "http://localhost:8001";

export default function Setup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ linkedin_client_id: "", linkedin_client_secret: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [alreadyConfigured, setAlreadyConfigured] = useState(false);

  useEffect(() => {
    api.get("/setup/status").then((res) => {
      if (res.data.has_linkedin_oauth) setAlreadyConfigured(true);
    }).catch(() => {});
  }, []);

  const redirectUri = `${BACKEND}/auth/linkedin/callback`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/setup/", { ...form, redirect_uri: redirectUri });
      setSaved(true);
    } catch {
      setError("Failed to save. Check that the backend is running.");
    } finally {
      setSaving(false);
    }
  };

  if (saved || alreadyConfigured) {
    return (
      <div className="space-y-6 max-w-md mx-auto pt-10">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold text-white">
            {alreadyConfigured && !saved ? "LinkedIn already configured" : "Credentials saved!"}
          </p>
          <p className="text-gray-400 text-sm">Would you like to link your LinkedIn account now?</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => { window.location.href = `${BACKEND}/auth/linkedin?next=jobs&origin=${encodeURIComponent(window.location.origin)}`; }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Yes, link LinkedIn →
          </button>
          <button
            onClick={() => navigate("/jobs")}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-colors"
          >
            No, go to Jobs
          </button>
        </div>
        <p className="text-center text-xs text-gray-600">
          You can always connect LinkedIn later from the nav bar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pt-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">LinkedIn Setup</h1>
        <p className="text-gray-400 text-sm">
          Enter your LinkedIn OAuth credentials to enable connection search and Easy Apply.
        </p>
      </div>

      <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-4 text-sm text-blue-300 space-y-1">
        <p className="font-medium text-blue-100">Where to get these?</p>
        <p>Go to <span className="font-mono bg-blue-900/40 px-1 rounded">developer.linkedin.com</span>, create an app, and copy the Client ID and Secret.</p>
        <p className="text-xs text-blue-400 pt-1">
          Add this as an authorized redirect URL in your LinkedIn app:<br />
          <span className="font-mono bg-blue-900/40 px-1 rounded break-all">{redirectUri}</span>
        </p>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(redirectUri)}
          className="text-xs text-blue-400 hover:text-blue-200 underline"
        >
          Copy redirect URI
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Client ID"
          placeholder="86xxxxxxxxxxxxxxxx"
          value={form.linkedin_client_id}
          onChange={(v) => setForm((f) => ({ ...f, linkedin_client_id: v }))}
          required
        />
        <Field
          label="Client Secret"
          placeholder="••••••••••••••••"
          value={form.linkedin_client_secret}
          onChange={(v) => setForm((f) => ({ ...f, linkedin_client_secret: v }))}
          type="password"
          required
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors"
        >
          {saving ? "Saving…" : "Save credentials →"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type = "text", required }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
