/** French flag — SVG (flag emojis don't render on Windows). */
export function FlagFr({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden>
      <rect width="10" height="20" fill="#3b5bdb" />
      <rect x="10" width="10" height="20" fill="#f1f3f5" />
      <rect x="20" width="10" height="20" fill="#e03131" />
    </svg>
  );
}
