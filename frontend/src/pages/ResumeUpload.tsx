import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import api from "../api/client";

type UploadState = "idle" | "uploading" | "parsing" | "done" | "error";

interface ParsedResume {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  skills: string[];
  experience: { title: string; company: string; duration: string }[];
  education: { degree: string; institution: string }[];
  experience_years?: number;
  target_roles?: string[];
  interests?: string[];
}

export default function ResumeUpload() {
  const navigate = useNavigate();
  const [state, setState] = useState<UploadState>("idle");
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [error, setError] = useState("");

  const { data: existingResume } = useQuery({
    queryKey: ["my-resume"],
    queryFn: async () => (await api.get("/resume/me")).data,
  });

  const upload = async (file: File) => {
    if (!file.name.match(/\.(pdf|docx)$/i)) {
      setError("Only PDF and DOCX files are supported.");
      setState("error");
      return;
    }
    setState("uploading");
    setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      setState("parsing");
      const { data } = await api.post<ParsedResume>("/resume/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setParsed(data);
      setState("done");
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        setError("Session expired. Please reconnect your LinkedIn account.");
      } else if (axios.isAxiosError(e) && e.response?.status === 422) {
        setError("Could not read the file. Make sure it's a valid PDF or DOCX.");
      } else {
        setError("Failed to parse resume. Check that your Groq API key is set in the backend .env file.");
      }
      setState("error");
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center pt-16 px-4">
    <div className="w-full max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Your Resume</h1>
        <p className="text-gray-400 mt-1 text-sm">We'll parse it and use it as the base for ATS-optimized versions per job.</p>
      </div>

      {existingResume && state === "idle" && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">Current resume: <span className="text-white">{existingResume.name}</span></p>
            <p className="text-xs text-gray-500 mt-0.5">{existingResume.email} · {existingResume.skills?.length || 0} skills detected</p>
          </div>
          <button
            onClick={() => navigate("/jobs")}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap ml-4"
          >
            Use existing →
          </button>
        </div>
      )}

      {/* Drop zone */}
      {state !== "done" && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-colors
            ${dragging ? "border-blue-400 bg-blue-900/10" : "border-gray-700 bg-gray-900 hover:border-gray-600"}`}
        >
          <div className="text-4xl">{state === "uploading" || state === "parsing" ? "⏳" : "📄"}</div>
          {state === "idle" || state === "error" ? (
            <>
              <div className="text-center">
                <p className="text-gray-200 font-medium">Drop your resume here</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse — PDF or DOCX</p>
              </div>
              <input type="file" accept=".pdf,.docx" onChange={onFileChange} className="hidden" />
              <span className="text-xs text-gray-600">Max 10 MB</span>
            </>
          ) : (
            <div className="text-center space-y-1">
              <p className="text-gray-200 font-medium animate-pulse">
                {state === "uploading" ? "Uploading…" : "Parsing with AI…"}
              </p>
              <p className="text-gray-500 text-sm">This takes a few seconds</p>
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </label>
      )}

      {/* Parsed preview */}
      {state === "done" && parsed && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Resume parsed successfully</h2>
            <button
              onClick={() => { setState("idle"); setParsed(null); }}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Replace file
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
            <Section label="Name & Email">
              <p className="text-gray-200 font-medium">{parsed.name}</p>
              <p className="text-gray-400 text-sm">{parsed.email}</p>
            </Section>

            <Section label={`Skills (${parsed.skills.length})`}>
              <div className="flex flex-wrap gap-2">
                {parsed.skills.map((s) => (
                  <span key={s} className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">{s}</span>
                ))}
              </div>
            </Section>

            <Section label="Experience">
              <ul className="space-y-2">
                {parsed.experience.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-gray-200 font-medium">{e.title}</span>
                    <span className="text-gray-400"> at {e.company}</span>
                    <span className="text-gray-600"> · {e.duration}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section label="Education">
              <ul className="space-y-1">
                {parsed.education.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-gray-200">{e.degree}</span>
                    <span className="text-gray-400"> · {e.institution}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          {/* Pre-fill preview & confirm */}
          <div className="bg-gray-900 border border-blue-900/50 rounded-2xl p-5 space-y-4">
            <p className="text-sm font-semibold text-blue-300">We'll pre-fill your preferences with:</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <PreFillRow label="Experience" value={parsed.experience_years ? `${parsed.experience_years} years` : "—"} />
              <PreFillRow label="Location" value={parsed.location || "—"} />
              <PreFillRow label="Target roles" value={parsed.target_roles?.join(", ") || "—"} />
              <PreFillRow label="Interests" value={parsed.interests?.join(", ") || "—"} />
              <PreFillRow label="Skills" value={`${parsed.skills.length} detected`} />
            </div>
            <p className="text-xs text-gray-500">You can edit all of these on the next screen.</p>
            <button
              onClick={() => navigate("/onboarding", {
                state: {
                  skills: parsed.skills || [],
                  target_roles: parsed.target_roles || [],
                  interests: parsed.interests || [],
                  experience_years: parsed.experience_years || 0,
                  preferred_locations: parsed.location ? [parsed.location] : [],
                }
              })}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Looks good — Set up preferences →
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</p>
      {children}
    </div>
  );
}

function PreFillRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-gray-500 uppercase tracking-wider text-[10px]">{label}</p>
      <p className="text-gray-200 truncate">{value}</p>
    </div>
  );
}
