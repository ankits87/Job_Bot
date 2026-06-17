import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TagInput from "../components/TagInput";
import api from "../api/client";

interface ProfileForm {
  target_roles: string[];
  skills: string[];
  interests: string[];
  experience_years: number;
  preferred_locations: string[];
}

const STEPS = ["Target Roles", "Skills", "Interests & Location"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const locationState = (window.history.state?.usr || {}) as Partial<ProfileForm>;
  const [form, setForm] = useState<ProfileForm>({
    target_roles: locationState.target_roles || [],
    skills: locationState.skills || [],
    interests: locationState.interests || [],
    experience_years: locationState.experience_years || 0,
    preferred_locations: locationState.preferred_locations || [],
  });

  const update = (key: keyof ProfileForm, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/onboarding/profile", form);
      navigate("/jobs");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${i < step ? "bg-blue-600 text-white" : i === step ? "bg-blue-500 text-white ring-2 ring-blue-300" : "bg-gray-800 text-gray-500"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "text-gray-200" : "text-gray-500"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-800 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step panels */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          {step === 0 && (
            <StepPanel title="What roles are you targeting?" subtitle="e.g. Software Engineer, Product Manager">
              <TagInput
                placeholder="Type a role and press Enter"
                tags={form.target_roles}
                onChange={(v) => update("target_roles", v)}
              />
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Years of experience</label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={form.experience_years}
                  onChange={(e) => update("experience_years", Number(e.target.value))}
                  className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </StepPanel>
          )}

          {step === 1 && (
            <StepPanel title="What are your current skills?" subtitle="Add all the technologies, tools, and competencies you have">
              <TagInput
                placeholder="Type a skill and press Enter"
                tags={form.skills}
                onChange={(v) => update("skills", v)}
              />
            </StepPanel>
          )}

          {step === 2 && (
            <StepPanel title="Interests & Locations" subtitle="What domains excite you, and where can you work?">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Interests / domains</label>
                <TagInput
                  placeholder="e.g. AI, Fintech, Climate Tech"
                  tags={form.interests}
                  onChange={(v) => update("interests", v)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Preferred locations</label>
                <TagInput
                  placeholder="e.g. Remote, Bangalore, New York"
                  tags={form.preferred_locations}
                  onChange={(v) => update("preferred_locations", v)}
                />
              </div>
            </StepPanel>
          )}

          {/* Nav buttons */}
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="text-sm text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
            >
              ← Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && form.target_roles.length === 0}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-6 py-2 rounded-xl transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium px-6 py-2 rounded-xl transition-colors"
              >
                {saving ? "Saving…" : "Save & Find Jobs →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
