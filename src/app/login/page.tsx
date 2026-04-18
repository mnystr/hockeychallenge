"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, signInWithGoogle } from "./actions";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        {mode === "signin"
          ? "Welcome back to hockeychallenge."
          : "Guardians: sign up to manage your player's profile."}
      </p>

      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete={mode === "signin" ? "username" : "email"}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {state?.errors?.email && (
            <p className="mt-1 text-sm text-red-600">{state.errors.email[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {state?.errors?.password && (
            <p className="mt-1 text-sm text-red-600">
              {state.errors.password[0]}
            </p>
          )}
        </div>

        {state?.message && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "Working..."
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        <span>or</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Continue with Google
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="font-medium text-blue-600 hover:underline"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </main>
  );
}
