interface Props {
  loading: boolean;
  suggestions: string[];
  currentSkills: string[];
  onAdd: (skill: string) => void;
}

export default function SkillSuggestions({ loading, suggestions, currentSkills, onAdd }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-400 animate-pulse">Analyzing your profile with AI…</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 rounded-full bg-gray-800 animate-pulse" style={{ width: `${60 + (i % 4) * 20}px` }} />
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0 && currentSkills.length > 0) {
    return <p className="text-sm text-gray-400">All AI suggestions have been added to your profile.</p>;
  }

  if (suggestions.length === 0) {
    return <p className="text-sm text-gray-400">No suggestions available. Add skills in the previous step first.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">Click to add skills to your profile:</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((skill) => {
          const alreadyAdded = currentSkills.includes(skill);
          return (
            <button
              key={skill}
              onClick={() => !alreadyAdded && onAdd(skill)}
              disabled={alreadyAdded}
              className={`text-sm px-3 py-1 rounded-full border transition-colors
                ${alreadyAdded
                  ? "border-green-700 bg-green-900/30 text-green-400 cursor-default"
                  : "border-gray-600 bg-gray-800 text-gray-300 hover:border-blue-500 hover:bg-blue-900/30 hover:text-blue-300"
                }`}
            >
              {alreadyAdded ? "✓ " : "+ "}{skill}
            </button>
          );
        })}
      </div>
    </div>
  );
}
