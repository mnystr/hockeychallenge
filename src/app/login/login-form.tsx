"use client";

import { useActionState, useState } from "react";
import { Sparkles } from "@/components/icons";
import { signIn, signUp, signInWithGoogle } from "./actions";

type Mode = "signin" | "signup";

export type LoginStrings = {
  signin_title: string;
  signup_title: string;
  signin_welcome: string;
  signup_welcome: string;
  email: string;
  password: string;
  submit_signin: string;
  submit_signup: string;
  submit_signin_pending: string;
  submit_signup_pending: string;
  or: string;
  google: string;
  no_account: string;
  have_account: string;
  toggle_to_signup: string;
  toggle_to_signin: string;
};

export default function LoginForm({
  initialMode,
  strings,
}: {
  initialMode: Mode;
  strings: LoginStrings;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="card card-pad-lg">
        <span
          className="pill pill-primary inline-flex items-center gap-1.5"
          style={{ fontWeight: 700 }}
        >
          <Sparkles className="h-3 w-3" /> hockeychallenge
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {mode === "signin" ? strings.signin_title : strings.signup_title}
        </h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          {mode === "signin" ? strings.signin_welcome : strings.signup_welcome}
        </p>

        <form action={formAction} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="label">
              {strings.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete={mode === "signin" ? "username" : "email"}
              required
              className="input"
            />
            {state?.errors?.email && (
              <p className="field-error">{state.errors.email[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="label">
              {strings.password}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              className="input"
            />
            {state?.errors?.password && (
              <p className="field-error">{state.errors.password[0]}</p>
            )}
          </div>

          {state?.message && (
            <p
              className="rounded-md px-3 py-2 text-sm"
              style={{
                background: "var(--danger-bg)",
                color: "var(--danger-fg)",
                border: "1px solid color-mix(in oklab, var(--danger) 30%, transparent)",
              }}
            >
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-lg w-full"
          >
            {pending
              ? mode === "signin"
                ? strings.submit_signin_pending
                : strings.submit_signup_pending
              : mode === "signin"
                ? strings.submit_signin
                : strings.submit_signup}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-2">
          <span className="h-px flex-1 bg-[color:var(--border)]" />
          <span>{strings.or}</span>
          <span className="h-px flex-1 bg-[color:var(--border)]" />
        </div>

        <form action={signInWithGoogle}>
          <button type="submit" className="btn btn-secondary btn-lg w-full">
            {strings.google}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "signin" ? strings.no_account : strings.have_account}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-ui-primary hover:underline"
          >
            {mode === "signin"
              ? strings.toggle_to_signup
              : strings.toggle_to_signin}
          </button>
        </p>
      </div>
    </main>
  );
}
