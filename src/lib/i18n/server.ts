import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, type Locale, translate } from "./dict";

const COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  return LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;
}

export async function getT(): Promise<
  (key: string, vars?: Record<string, string | number>) => string
> {
  const locale = await getLocale();
  return (key, vars) => translate(locale, key, vars);
}
