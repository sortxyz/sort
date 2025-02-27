import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import gfm from "remark-gfm";

const remarkPlugins = [gfm] satisfies React.ComponentPropsWithoutRef<
  typeof ReactMarkdown
>["remarkPlugins"];

const rehypePlugins = [
  rehypeSlug,
  rehypeAutolinkHeadings,
  rehypeHighlight,
] satisfies React.ComponentPropsWithoutRef<
  typeof ReactMarkdown
>["rehypePlugins"];

export function Markdown({ children }: { children: string | null }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
      {children}
    </ReactMarkdown>
  );
}
