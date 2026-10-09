import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CatMark } from "./cat";
import { HomeLink, LogoutButton, NavLinks } from "./header-client";

export async function Logo() {
  const t = await getTranslations("header");
  return (
    <HomeLink className="flex items-center gap-2.5 group">
      <CatMark className="size-8 text-ink transition-transform group-hover:-rotate-6" />
      <span className="text-xl font-bold tracking-[-0.04em]">
        ppush<span className="text-accent">.</span>
        <span className="ml-2.5 hidden text-xs font-normal tracking-normal text-ink-faint sm:inline">
          {t("tagline")}
        </span>
      </span>
    </HomeLink>
  );
}

export async function Header() {
  const user = await currentUser();
  const t = await getTranslations("header");
  const recoveryPending =
    user?.role === "ADMIN"
      ? await prisma.recoveryRequest.count({ where: { status: "PENDING" } })
      : 0;
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* link outside the logo: the logo is a link itself (no nested <a>) */}
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <Link
            href="/why"
            aria-label={t("why")}
            className="whitespace-nowrap rounded-full border border-line px-3 py-1 text-xs text-ink-dim transition-colors hover:border-accent/40 hover:text-accent-soft"
          >
            <span className="sm:hidden">{t("whyShort")}</span>
            <span className="hidden sm:inline">{t("why")}</span>
          </Link>
        </div>
        {user ? (
          <div className="flex items-center gap-1.5">
            <NavLinks isAdmin={user.role === "ADMIN"} recoveryPending={recoveryPending} />
            <span className="mx-2 hidden text-xs text-ink-faint md:inline">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-[10px] border border-line px-4 py-2 text-sm text-ink-dim transition-colors hover:border-line-soft hover:text-ink"
          >
            {t("login")}
          </Link>
        )}
      </div>
    </header>
  );
}
