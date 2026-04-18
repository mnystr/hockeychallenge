"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setTaskProgress(
  slug: string,
  challengeId: string,
  taskId: string,
  count: number,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const clamped = Math.max(0, Math.min(count, 100_000));

  const { error } = await supabase
    .from("task_progress")
    .upsert(
      { task_id: taskId, user_id: user.id, count: clamped },
      { onConflict: "task_id,user_id" },
    );

  if (error) throw new Error(error.message);

  revalidatePath(`/t/${slug}/challenges/${challengeId}`);
}
