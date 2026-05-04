"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "hc-install-banner-dismissed-at";
const DISMISS_DAYS = 30;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Messages = {
  iosTitle: string;
  iosBody: string;
  androidTitle: string;
  androidBody: string;
  install: string;
  dismiss: string;
};

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const uaData = (
    window.navigator as unknown as { userAgentData?: { mobile?: boolean } }
  ).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") {
    return uaData.mobile;
  }
  return /Mobi|Android/i.test(window.navigator.userAgent);
}

let cachedIosShouldShow: boolean | undefined;

function detectIosShouldShow(): boolean {
  if (cachedIosShouldShow !== undefined) return cachedIosShouldShow;
  if (typeof window === "undefined") return false;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true;
  if (standalone) {
    cachedIosShouldShow = false;
    return false;
  }

  const dismissedAt = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
  if (
    dismissedAt &&
    Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000
  ) {
    cachedIosShouldShow = false;
    return false;
  }

  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isIOSSafari =
    isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  cachedIosShouldShow = isIOSSafari;
  return isIOSSafari;
}

const subscribeNoop = () => () => {};
const getServerIosShouldShow = () => false;

export default function InstallBanner({ messages }: { messages: Messages }) {
  const iosShouldShow = useSyncExternalStore(
    subscribeNoop,
    detectIosShouldShow,
    getServerIosShouldShow,
  );

  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function onBip(e: Event) {
      e.preventDefault();
      if (!isMobileDevice()) return;
      const dismissedAt = Number(
        window.localStorage.getItem(STORAGE_KEY) ?? "0",
      );
      if (
        dismissedAt &&
        Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000
      ) {
        return;
      }
      setBipEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (hidden) return null;

  const mode: "android" | "ios" | null = bipEvent
    ? "android"
    : iosShouldShow
      ? "ios"
      : null;
  if (mode === null) return null;

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    cachedIosShouldShow = false;
    setHidden(true);
  }

  async function install() {
    if (!bipEvent) return;
    await bipEvent.prompt();
    await bipEvent.userChoice;
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setHidden(true);
  }

  return (
    <div
      className="fixed bottom-3 left-3 right-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur"
      role="dialog"
      aria-label={
        mode === "ios" ? messages.iosTitle : messages.androidTitle
      }
      style={{
        background: "color-mix(in oklab, var(--surface) 92%, transparent)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    >
      <div
        className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
        aria-hidden="true"
        style={{ background: "var(--ui-primary)" }}
      >
        <span
          style={{
            color: "#ffffff",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: -0.5,
          }}
        >
          HC
        </span>
      </div>
      <div className="min-w-0 flex-1 text-sm leading-tight">
        <div className="font-semibold">
          {mode === "ios" ? messages.iosTitle : messages.androidTitle}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
          {mode === "ios" ? messages.iosBody : messages.androidBody}
        </div>
      </div>
      {mode === "android" ? (
        <button
          type="button"
          onClick={install}
          className="flex-none rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--ui-primary)" }}
        >
          {messages.install}
        </button>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label={messages.dismiss}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-base leading-none transition hover:bg-black/5"
        style={{ color: "var(--muted)" }}
      >
        ×
      </button>
    </div>
  );
}
