import { SafeImage } from "./ui";

/* Splits plain-text content into headings (## ), quotes (> ) and paragraphs. */
function renderBody(text = "") {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      if (block.startsWith("## ")) return <h2 key={i}>{block.slice(3)}</h2>;
      if (block.startsWith("### ")) return <h3 key={i}>{block.slice(4)}</h3>;
      if (block.startsWith("> "))
        return (
          <blockquote key={i}>
            <p>{block.replace(/^>\s?/gm, "")}</p>
          </blockquote>
        );
      return <p key={i}>{block}</p>;
    });
}

/* Pass whatever your article route already loads. Field names are fallbacks. */
export default function ArticleView({ article }) {
  const a = article;
  const title = a.title || a.name;
  const date = a.published_at
    ? new Date(a.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const body = a.content || a.body || a.description;

  return (
    <article className="tovna-article">
      <header className="tovna-hero">
        <SafeImage
          src={a.image_url}
          alt=""
          className="tovna-hero-img"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div className="tovna-hero-overlay" />
        <div className="tovna-hero-content">
          {(a.province || a.category) && (
            <span className="tovna-badge tovna-badge-static">
              {a.province || a.category}
            </span>
          )}
          <h1>{title}</h1>
          <p className="tovna-hero-meta">
            {[
              a.author && `By ${a.author}`,
              date,
              a.read_minutes && `${a.read_minutes} min read`,
            ]
              .filter(Boolean)
              .join("   |   ")}
          </p>
        </div>
      </header>

      <div className="tovna-article-column">
        {a.description && body !== a.description && (
          <p className="tovna-lede">{a.description}</p>
        )}
        {renderBody(body)}
      </div>
    </article>
  );
}
