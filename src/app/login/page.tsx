import { getT } from "@/lib/i18n/server";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const initialMode = mode === "signup" ? "signup" : "signin";
  const t = await getT();

  return (
    <LoginForm
      initialMode={initialMode}
      strings={{
        signin_title: t("auth.signin_title"),
        signup_title: t("auth.signup_title"),
        signin_welcome: t("auth.signin_welcome"),
        signup_welcome: t("auth.signup_welcome"),
        email: t("auth.email"),
        password: t("auth.password"),
        submit_signin: t("auth.submit_signin"),
        submit_signup: t("auth.submit_signup"),
        submit_signin_pending: t("auth.submit_signin_pending"),
        submit_signup_pending: t("auth.submit_signup_pending"),
        or: t("auth.or"),
        google: t("auth.google"),
        no_account: t("auth.no_account"),
        have_account: t("auth.have_account"),
        toggle_to_signup: t("auth.toggle_to_signup"),
        toggle_to_signin: t("auth.toggle_to_signin"),
      }}
    />
  );
}
