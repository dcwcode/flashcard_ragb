function formatText(text: string): string {
  return text.replace(/<br\s*\/?>/gi, "\n");
}

// Renders card text with line breaks. Supports literal newlines and `<br>` tags.
export function CardText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`whitespace-pre-line ${className ?? ""}`}>
      {formatText(text)}
    </span>
  );
}
