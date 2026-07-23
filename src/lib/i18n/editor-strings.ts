import type { MarkdownEditorStrings } from "@/components/MarkdownEditor";

/**
 * The MarkdownEditor toolbar strings are needed by every admin form that
 * embeds the editor; build them once from the page's translator so the
 * server → client boundary stays a plain serialisable object.
 */
export function markdownEditorStrings(
  t: (key: string, vars?: Record<string, string | number>) => string,
): MarkdownEditorStrings {
  return {
    write: t("editor.write"),
    preview: t("editor.preview"),
    empty_preview: t("editor.empty_preview"),
    bold: t("editor.bold"),
    italic: t("editor.italic"),
    heading: t("editor.heading"),
    bullet_list: t("editor.bullet_list"),
    numbered_list: t("editor.numbered_list"),
    quote: t("editor.quote"),
    link: t("editor.link"),
    image: t("editor.image"),
    youtube: t("editor.youtube"),
    link_prompt: t("editor.link_prompt"),
    image_prompt: t("editor.image_prompt"),
    youtube_prompt: t("editor.youtube_prompt"),
    youtube_invalid: t("editor.youtube_invalid"),
  };
}
