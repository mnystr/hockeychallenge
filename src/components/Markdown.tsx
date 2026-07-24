import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { youTubeVideoId, youTubeEmbedUrl } from "@/lib/media/youtube";

/**
 * Shared Markdown renderer for challenge descriptions, lesson bodies and
 * leaderboard descriptions. On top of GFM it turns *bare* YouTube links
 * (link text equals the URL, which is what pasting a URL produces) into
 * privacy-enhanced inline video embeds. Explicitly-titled links like
 * [warm-up video](https://youtu.be/...) stay ordinary links.
 */
export default function Markdown({
  children,
  invert = false,
}: {
  children: string;
  invert?: boolean;
}) {
  return (
    <article className={`md${invert ? " md-invert" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren, ...rest }) => {
            const text =
              Array.isArray(linkChildren) && linkChildren.length === 1
                ? linkChildren[0]
                : linkChildren;
            const isBare = typeof text === "string" && text === href;
            const videoId = href && isBare ? youTubeVideoId(href) : null;
            if (videoId) {
              return (
                <span className="yt-embed">
                  <iframe
                    src={youTubeEmbedUrl(videoId)}
                    title="YouTube video"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </span>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
                {linkChildren}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </article>
  );
}
