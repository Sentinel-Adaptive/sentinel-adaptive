import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { formatEnumLabel } from "./format.js";
import { en, type MessageKey } from "./locales/en.js";
import { es } from "./locales/es.js";

export type Locale = "en" | "es";

const storageKey = "sentinel-locale";
const catalogs: Record<Locale, Record<MessageKey, string>> = { en, es };

type Vars = Record<string, string | number>;

export type Translate = (key: MessageKey, vars?: Vars) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readLocale(): Locale {
  try {
    return localStorage.getItem(storageKey) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) {
    return template;
  }
  return template.replaceAll(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof document === "undefined" ? "en" : readLocale(),
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(storageKey, locale);
    } catch {
      // Persistence is optional for the operator session.
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => interpolate(catalogs[locale][key], vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return value;
}

export function translateKnown(
  t: Translate,
  prefix: "enum" | "metric" | "service" | "health",
  value: string,
): string {
  const key = `${prefix}.${value}`;
  if (key in en) {
    return t(key as MessageKey);
  }
  return formatEnumLabel(value);
}

export const messageKeys = Object.keys(en) as MessageKey[];
