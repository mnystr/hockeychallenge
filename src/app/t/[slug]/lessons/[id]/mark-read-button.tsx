"use client";

import { useTransition } from "react";
import { markLessonRead } from "../actions";
import { Check } from "@/components/icons";

export default function MarkReadButton({
  slug,
  lessonId,
  strings,
}: {
  slug: string;
  lessonId: string;
  strings: { cta: string; pending: string };
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-primary"
      onClick={() =>
        startTransition(async () => {
          await markLessonRead(slug, lessonId);
        })
      }
    >
      <Check className="h-4 w-4" />
      {pending ? strings.pending : strings.cta}
    </button>
  );
}
