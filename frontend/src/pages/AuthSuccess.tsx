import { useAuthStore } from "../store/authStore";

function parseJwt(token: string) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export default function AuthSuccess() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const next = params.get("next") ?? "jobs";
  const setAuth = useAuthStore((s) => s.setAuth);

  const proceed = () => {
    if (token) {
      const payload = parseJwt(token);
      setAuth(token, {
        id: parseInt(payload?.sub ?? "0"),
        name: payload?.name ?? payload?.email?.split("@")[0] ?? "User",
        email: payload?.email ?? "",
      });
    }
    window.location.href = `/${next}`;
  };

  // Auto-proceed on mount
  if (typeof window !== "undefined" && token) {
    const payload = parseJwt(token);
    if (payload) {
      setAuth(token, {
        id: parseInt(payload?.sub ?? "0"),
        name: payload?.name ?? payload?.email?.split("@")[0] ?? "User",
        email: payload?.email ?? "",
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-950 px-4">
      <div className="text-center space-y-2">
        <p className="text-white font-semibold text-lg">LinkedIn connected!</p>
        <p className="text-gray-400 text-sm">Click below to continue to the app.</p>
      </div>
      <button
        onClick={proceed}
        className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-xl transition-colors"
      >
        Continue to app →
      </button>
      {!token && (
        <p className="text-red-400 text-xs">No token found in URL. Try connecting LinkedIn again.</p>
      )}
    </div>
  );
}
