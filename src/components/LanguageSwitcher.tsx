import { setLocale } from "@/lib/i18n/actions";
import { getLocale } from "@/lib/i18n/server";

export default async function LanguageSwitcher() {
  const locale = await getLocale();

  async function toSv() {
    "use server";
    await setLocale("sv");
  }
  async function toEn() {
    "use server";
    await setLocale("en");
  }

  return (
    <div className="fixed right-3 top-3 z-50 flex gap-1 rounded-full border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur">
      <form action={toSv}>
        <button
          type="submit"
          aria-label="Svenska"
          title="Svenska"
          aria-pressed={locale === "sv"}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
            locale === "sv"
              ? "ring-2 ring-blue-500"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          <SeFlag />
        </button>
      </form>
      <form action={toEn}>
        <button
          type="submit"
          aria-label="English"
          title="English"
          aria-pressed={locale === "en"}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
            locale === "en"
              ? "ring-2 ring-blue-500"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          <GbFlag />
        </button>
      </form>
    </div>
  );
}

function SeFlag() {
  return (
    <svg
      viewBox="0 0 16 10"
      className="h-5 w-5 rounded-sm"
      aria-hidden="true"
    >
      <rect width="16" height="10" fill="#005b9f" />
      <rect x="0" y="4" width="16" height="2" fill="#fecc00" />
      <rect x="5" y="0" width="2" height="10" fill="#fecc00" />
    </svg>
  );
}

function GbFlag() {
  return (
    <svg
      viewBox="0 0 60 30"
      className="h-5 w-5 rounded-sm"
      aria-hidden="true"
    >
      <clipPath id="gb-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="gb-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#gb-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 60,30 M60,0 0,30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0,0 60,30 M60,0 0,30"
          clipPath="url(#gb-t)"
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}
