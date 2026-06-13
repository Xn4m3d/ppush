import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { CatMark } from "./cat";
import { LogoutButton, NavLinks } from "./header-client";

export async function Logo() {
  const t = await getTranslations("header");
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-deep shadow-[0_4px_16px_-2px_rgba(124,108,255,0.5)] transition-transform group-hover:scale-105">
        <CatMark className="size-6 text-white" />
      </span>
      <span className="text-lg font-semibold tracking-tight">
        ppush
        <span className="ml-2 hidden text-xs font-normal text-ink-faint sm:inline">
          {t("tagline")}
        </span>
      </span>
    </Link>
  );
}

export async function Header() {
  const user = await currentUser();
  const t = await getTranslations("header");
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        {user ? (
          <div className="flex items-center gap-1.5">
            <NavLinks isAdmin={user.role === "ADMIN"} />
            <span className="mx-2 hidden text-xs text-ink-faint md:inline">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-xl border border-line px-4 py-2 text-sm text-ink-dim transition-colors hover:border-line-soft hover:text-ink"
          >
            {t("login")}
          </Link>
        )}
      </div>
    </header>
  );
}
