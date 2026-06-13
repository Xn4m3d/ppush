import Link from "next/link";
import { Home } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Explicit "Home" button for pages without a header (auth, /p, legal…). */
export async function BackHome({ className = "" }: { className?: string }) {
  const t = await getTranslations("common");
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel/60 px-3 py-1.5 text-sm text-ink-dim backdrop-blur-sm transition-colors hover:border-line-soft hover:text-ink ${className}`}
    >
      <Home className="size-4" />
      {t("home")}
    </Link>
  );
}
