import { useState, KeyboardEvent } from "react";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ tags, onChange, placeholder }: Props) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput("");
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !input && tags.length) remove(tags[tags.length - 1]);
  };

  return (
    <div className="flex flex-wrap gap-2 bg-gray-800 border border-gray-700 rounded-xl p-3 focus-within:ring-2 focus-within:ring-blue-500 min-h-[52px]">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-gray-700 text-gray-200 text-sm px-3 py-1 rounded-full">
          {tag}
          <button onClick={() => remove(tag)} className="text-gray-400 hover:text-red-400 ml-1 leading-none">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[140px] bg-transparent text-sm text-white placeholder-gray-500 outline-none"
      />
    </div>
  );
}
