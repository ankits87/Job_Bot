import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuthStore } from "../store/authStore";

type Mode = "login" | "register";

export default function Landing() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const payload = mode === "register"
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email, password: form.password };
      const { data } = await api.post(endpoint, payload);
      setAuth(data.token, data.user);
      // Check if user already has a profile — skip onboarding if so
      try {
        const profileRes = await api.get("/onboarding/profile", {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        navigate(profileRes.data ? "/jobs" : "/resume");
      } catch {
        navigate("/resume");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gray-950 px-4">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-bold text-white">JobBot</h1>
        <p className="text-gray-400 text-base max-w-md">
          AI-powered job search — upload your CV, get matched roles, apply automatically.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-5">
        {/* Mode toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-700">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors
                ${mode === m ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
            >
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <Field label="Full Name" type="text" placeholder="Jane Doe" value={form.name} onChange={set("name")} required />
          )}
          <Field label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
          <Field label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} required />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-2xl w-full text-center">
        {[
          { icon: "📄", title: "CV Upload", desc: "We pre-fill your profile from your resume" },
          { icon: "🔍", title: "Smart Search", desc: "Jobs matched and ranked to your profile" },
          { icon: "⚡", title: "Auto Apply", desc: "One-click Easy Apply via LinkedIn" },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-1">
            <div className="text-2xl">{icon}</div>
            <div className="text-sm font-medium text-gray-200">{title}</div>
            <div className="text-xs text-gray-500">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label, type, placeholder, value, onChange, required,
}: {
  label: string; type: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
