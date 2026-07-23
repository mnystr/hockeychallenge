"use client";

import { useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import { youTubeVideoId } from "@/lib/media/youtube";

export type MarkdownEditorStrings = {
  write: string;
  preview: string;
  empty_preview: string;
  bold: string;
  italic: string;
  heading: string;
  bullet_list: string;
  numbered_list: string;
  quote: string;
  link: string;
  image: string;
  youtube: string;
  link_prompt: string;
  image_prompt: string;
  youtube_prompt: string;
  youtube_invalid: string;
};

/**
 * Rich-text editing for Markdown-backed fields without markdown knowledge:
 * a formatting toolbar mutates the textarea selection and a Preview tab
 * renders exactly what players will see (including YouTube embeds). The
 * textarea keeps the form field name, so server actions are unchanged.
 */
export default function MarkdownEditor({
  name,
  defaultValue,
  rows = 10,
  strings,
}: {
  name: string;
  defaultValue: string;
  rows?: number;
  strings: MarkdownEditorStrings;
}) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyEdit(
    next: string,
    selectionStart: number,
    selectionEnd: number,
  ) {
    setValue(next);
    // Restore focus + selection after React re-renders the textarea.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  /** Wrap the current selection with before/after markers (e.g. **bold**). */
  function wrapSelection(before: string, after: string, placeholder: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || placeholder;
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    applyEdit(next, start + before.length, start + before.length + selected.length);
  }

  /** Prefix every line in the selection (e.g. "- " for lists). */
  function prefixLines(prefix: string | ((i: number) => string)) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const sliceEnd = end > lineStart ? end : lineStart;
    const block = value.slice(lineStart, sliceEnd);
    const prefixed = block
      .split("\n")
      .map((line, i) => (typeof prefix === "string" ? prefix : prefix(i)) + line)
      .join("\n");
    const next = value.slice(0, lineStart) + prefixed + value.slice(sliceEnd);
    applyEdit(next, lineStart, lineStart + prefixed.length);
  }

  /** Insert a block of text on its own line at the cursor. */
  function insertBlock(block: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start } = el;
    const needsLeadingBreak = start > 0 && value[start - 1] !== "\n";
    const insertion = `${needsLeadingBreak ? "\n\n" : ""}${block}\n`;
    const next = value.slice(0, start) + insertion + value.slice(start);
    const cursor = start + insertion.length;
    applyEdit(next, cursor, cursor);
  }

  function promptLink() {
    const url = window.prompt(strings.link_prompt);
    if (!url) return;
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const text = value.slice(start, end) || url;
    const md = `[${text}](${url})`;
    const next = value.slice(0, start) + md + value.slice(end);
    applyEdit(next, start + 1, start + 1 + text.length);
  }

  function promptImage() {
    const url = window.prompt(strings.image_prompt);
    if (!url) return;
    insertBlock(`![](${url})`);
  }

  function promptYouTube() {
    const url = window.prompt(strings.youtube_prompt);
    if (!url) return;
    if (!youTubeVideoId(url.trim())) {
      window.alert(strings.youtube_invalid);
      return;
    }
    // A bare URL on its own line is what the renderer turns into an embed.
    insertBlock(url.trim());
  }

  return (
    <div className="md-editor">
      <div className="md-editor-bar">
        <div className="md-editor-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            className={`md-editor-tab ${tab === "write" ? "is-active" : ""}`}
            onClick={() => setTab("write")}
          >
            {strings.write}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={`md-editor-tab ${tab === "preview" ? "is-active" : ""}`}
            onClick={() => setTab("preview")}
          >
            {strings.preview}
          </button>
        </div>
        {tab === "write" && (
          <div className="md-editor-tools">
            <ToolButton
              label={strings.bold}
              onClick={() => wrapSelection("**", "**", strings.bold)}
            >
              <strong>B</strong>
            </ToolButton>
            <ToolButton
              label={strings.italic}
              onClick={() => wrapSelection("*", "*", strings.italic)}
            >
              <em>I</em>
            </ToolButton>
            <ToolButton
              label={strings.heading}
              onClick={() => prefixLines("## ")}
            >
              H
            </ToolButton>
            <span className="md-editor-sep" aria-hidden />
            <ToolButton
              label={strings.bullet_list}
              onClick={() => prefixLines("- ")}
            >
              •–
            </ToolButton>
            <ToolButton
              label={strings.numbered_list}
              onClick={() => prefixLines((i) => `${i + 1}. `)}
            >
              1.
            </ToolButton>
            <ToolButton label={strings.quote} onClick={() => prefixLines("> ")}>
              ❝
            </ToolButton>
            <span className="md-editor-sep" aria-hidden />
            <ToolButton label={strings.link} onClick={promptLink}>
              🔗
            </ToolButton>
            <ToolButton label={strings.image} onClick={promptImage}>
              🖼
            </ToolButton>
            <ToolButton label={strings.youtube} onClick={promptYouTube}>
              ▶
            </ToolButton>
          </div>
        )}
      </div>

      <textarea
        ref={textareaRef}
        id={name}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="textarea input-mono md-editor-textarea"
        style={tab === "preview" ? { display: "none" } : undefined}
      />
      {tab === "preview" && (
        <div className="md-editor-preview">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted">{strings.empty_preview}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="md-editor-tool"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
