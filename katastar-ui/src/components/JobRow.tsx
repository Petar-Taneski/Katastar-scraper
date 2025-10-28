"use client";
import { useEffect } from "react";

type Props = {
  idx: number;
  value: { region: string; katastar_region?: string; parcel: string };
  onChange: (idx: number, field: "region" | "katastar_region" | "parcel", v: string) => void;
  onRemove: (idx: number) => void;
    isDeleteDisabled: boolean; // New prop to control delete button state
};

export default function JobRow({ idx, value, onChange, onRemove, isDeleteDisabled }: Props) {
  useEffect(() => {
    // could auto-focus first row, etc.
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end rounded-2xl p-4 border border-zinc-200 bg-white/60 hover:shadow-sm transition">
      <div className="flex flex-col">
        <label className="text-sm text-black">Регион *</label>
        <input
          className="text-gray-400 rounded-xl border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          placeholder="Регион на парцела"
          value={value.region}
          onChange={(e) => onChange(idx, "region", e.target.value)}
        />
      </div>

      <div className="flex flex-col">
        <label className="text-sm text-black">Катастарски регион (опционално)</label>
        <input
          className="text-gray-400 rounded-xl border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          placeholder="Катастарски оддел"
          value={value.katastar_region ?? ""}
          onChange={(e) => onChange(idx, "katastar_region", e.target.value)}
        />
      </div>

      <div className="flex flex-col">
        <label className="text-sm text-black">Парцела *</label>
        <input
          className="text-gray-400 rounded-xl border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          placeholder="Број на парцела"
          value={value.parcel}
          onChange={(e) => onChange(idx, "parcel", e.target.value)}
        />
      </div>

     <div className="flex md:justify-end gap-2">
  <button
    type="button"
    onClick={() => onRemove(idx)}
    // 1. Add the disabled attribute
    disabled={isDeleteDisabled} 
    className={`w-full md:w-auto rounded-xl border border-red-200 text-red-700 px-4 py-2 transition ${
      // 2. Conditionally apply styling for the disabled state
      isDeleteDisabled 
        ? 'opacity-50 cursor-not-allowed bg-white' // Disabled look (lower opacity, no hover)
        : 'hover:bg-red-50' // Regular hover effect when active
    }`}
  >
    Избриши
  </button>
</div>
    </div>
  );
}
