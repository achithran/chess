"use client";

import { Globe } from "lucide-react";
import { LANGUAGES, useLanguageStore } from "@/store/language";

export function LanguageSwitcher() {
  const { code, setCode } = useLanguageStore();

  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-300">
      <Globe className="h-4 w-4 text-gray-400" />
      <select
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-label="Explanation language"
        className="cursor-pointer rounded-lg border border-surface-border bg-surface-card px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-brand"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-surface-card">
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
