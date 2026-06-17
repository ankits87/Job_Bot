import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import TagInput from "../components/TagInput";

interface Profile {
  skills: string[];
  interests: string[];
  target_roles: string[];
  experience_years: number;
  preferred_locations: string[];
}

interface ResumeData {
  resume_id: number;
  file_type: string;
  name: string;
  email: string;
  skills: string[];
  experience: { title: string; company: string; duration: string }[];
  education: { degree: string; institution: string }[];
}

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Profile | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: async () => (await api.get("/onboarding/profile")).data,
  });

  const { data: resume, isLoading: resumeLoading } = useQuery<ResumeData>({
    queryKey: ["my-resume"],
    queryFn: async () => (await api.get("/resume/me")).data,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Profile) => api.post("/onboarding/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    },
  });

  const startEdit = () => {
    if (profile) setForm({ ...profile });
    setEditing(true);
  };

  const update = (key: keyof Profile, value: unknown) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  if (profileLoading || resumeLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl bg-gray-900 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-gray-400 text-sm mt-1">Your skills, preferences, and resume — all in one place</p>
        </div>
        <div className="flex gap-3">
          {!editing && (
            <button
              onClick={startEdit}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Resume card */}
      <Section title="Resume">
        {resume ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{resume.name}</p>
                <p className="text-gray-400 text-sm">{resume.email}</p>
              </div>
              <div className="flex gap-3">
                <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full uppercase">{resume.file_type}</span>
                <button
                  onClick={() => navigate("/resume")}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Replace →
                </button>
              </div>
            </div>

            {resume.experience.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Experience</p>
                {resume.experience.map((e, i) => (
                  <p key={i} className="text-sm text-gray-300">
                    <span className="font-medium">{e.title}</span>
                    <span className="text-gray-500"> at {e.company}</span>
                    {e.duration && <span className="text-gray-600"> · {e.duration}</span>}
                  </p>
                ))}
              </div>
            )}

            {resume.education.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Education</p>
                {resume.education.map((e, i) => (
                  <p key={i} className="text-sm text-gray-300">
                    {e.degree} · <span className="text-gray-500">{e.institution}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 space-y-3">
            <p className="text-gray-500 text-sm">No resume uploaded yet.</p>
            <button
              onClick={() => navigate("/resume")}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              Upload Resume
            </button>
          </div>
        )}
      </Section>

      {/* Profile / preferences */}
      {editing && form ? (
        <Section title="Edit Preferences">
          <div className="space-y-5">
            <Field label="Target Roles">
              <TagInput tags={form.target_roles} onChange={(v) => update("target_roles", v)} placeholder="Add a role and press Enter" />
            </Field>
            <Field label="Skills">
              <TagInput tags={form.skills} onChange={(v) => update("skills", v)} placeholder="Add a skill and press Enter" />
            </Field>
            <Field label="Interests">
              <TagInput tags={form.interests} onChange={(v) => update("interests", v)} placeholder="e.g. Fintech, AI" />
            </Field>
            <Field label="Preferred Locations">
              <TagInput tags={form.preferred_locations} onChange={(v) => update("preferred_locations", v)} placeholder="e.g. Remote, Mumbai" />
            </Field>
            <Field label="Years of Experience">
              <input
                type="number" min={0} max={40}
                value={form.experience_years}
                onChange={(e) => update("experience_years", Number(e.target.value))}
                className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-xl transition-colors"
              >
                {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Section>
      ) : profile ? (
        <Section title="Preferences">
          <div className="space-y-4">
            <InfoRow label="Target Roles" tags={profile.target_roles} />
            <InfoRow label="Skills" tags={profile.skills} />
            <InfoRow label="Interests" tags={profile.interests} />
            <InfoRow label="Preferred Locations" tags={profile.preferred_locations} />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Experience</p>
              <p className="text-sm text-gray-300">{profile.experience_years} year{profile.experience_years !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </Section>
      ) : (
        <Section title="Preferences">
          <p className="text-gray-500 text-sm">No profile yet. Upload your resume to get started.</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1.5">{label}</p>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">{t}</span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">—</p>
      )}
    </div>
  );
}
