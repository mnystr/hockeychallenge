"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markLessonRead(slug: string, lessonId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_lesson_read", {
    p_lesson_id: lessonId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/t/${slug}/lessons/${lessonId}`);
  revalidatePath(`/t/${slug}/lessons`);
  // Read points feed active points-leaderboards immediately.
  revalidatePath(`/t/${slug}/leaderboards`);
}
