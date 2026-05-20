import zh from "./zh";
import en from "./en";

const locales: Record<string, Record<string, string>> = { zh, en };

const STORAGE_KEY = "mindforge_language";

export type Language = "zh" | "en";

let currentLanguage: Language = (localStorage.getItem(STORAGE_KEY) as Language) || "zh";

const listeners: Array<(lang: Language) => void> = [];

export function getCurrentLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language) {
  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((fn) => fn(lang));
}

export function onLanguageChange(fn: (lang: Language) => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function t(key: string, params?: Record<string, string | number>): string {
  const locale = locales[currentLanguage] || zh;
  let text = locale[key];
  if (text === undefined) {
    // fallback to zh
    text = zh[key];
  }
  if (text === undefined) {
    return key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

// React hook
import { useState, useEffect } from "react";

export function useTranslation() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = onLanguageChange(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  return {
    t: (key: string, params?: Record<string, string | number>) => t(key, params),
    lang: currentLanguage,
    setLanguage,
    isZh: currentLanguage === "zh",
    isEn: currentLanguage === "en",
  };
}
