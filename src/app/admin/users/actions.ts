"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
  const { data: appUser } = await supabase
    .from("app_users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!appUser?.is_super_admin) throw new Error("unauthorized");
  return user.id;
}

export async function setSuperAdmin(userId: string, grant: boolean) {
  await requireSuperAdmin();
  const admin = createServiceClient();
  // The app_users trigger enforces the 2-super-admin floor on demotion,
  // so we rely on it for the critical check. Returning the constraint
  // error is fine — it'll bubble up as an exception.
  const { error } = await admin
    .from("app_users")
    .update({ is_super_admin: grant })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
