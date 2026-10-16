"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, Plus, History, UserCircle, Users } from "lucide-react";
import { type ReactNode } from "react";
import { cls } from "./ui";
import { stripLocale } from "@/i18n/locale";
import { useLocalePath } from "@/i18n/use-locale-path";

const links = [
  { href: "/", key: "new", icon: Plus },
  { href: "/pushes", key: "history", icon: History },
  { href: "/account", key: "account", icon: UserCircle },
] as const;

/**
 * Resets the home form. A Link to "/" while ALREADY
 * on "/" doesn't remount the component → the push "success" screen would stay
 * shown. We emit an event listened to by PushForm to start fresh (SPA,
 * without reloading).
 */
function fireHomeReset() {
  window.dispatchEvent(new Event("ppush:reset"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Clickable logo: back home + form reset. */
export function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  // path without the language prefix: /fr and / are both the home page
  const pathname = stripLocale(usePathname());
  const lp = useLocalePath();
  return (
    <Link
      href={lp("/")}
      className={className}
      onClick={(e) => {
        if (pathname === "/") {
          e.preventDefault();
          fireHomeReset();
        }
      }}
    >
      {children}
    </Link>
  );
}

export function NavLinks({ isAdmin, recoveryPending = 0 }: { isAdmin: boolean; recoveryPending?: number }) {
  const pathname = stripLocale(usePathname());
  const lp = useLocalePath();
  const t = useTranslations("header.nav");
  const all = isAdmin
    ? [...links, { href: "/admin", key: "admin", icon: Users } as const]
    : links;
  return (
    <nav className="flex items-center gap-1">
      {all.map(({ href, key, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        const showBadge = href === "/admin" && recoveryPending > 0;
        return (
          <Link
            key={href}
            href={lp(href)}
            onClick={(e) => {
              if (href === "/" && pathname === "/") {
                e.preventDefault();
                fireHomeReset();
              }
            }}
            className={cls(
              "relative flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm transition-colors sm:px-3",
              active
                ? "bg-panel text-ink shadow-[inset_0_-2px_0_var(--color-accent)]"
                : "text-ink-dim hover:bg-panel hover:text-ink"
            )}
          >
            <Icon className="size-4" />
            <span className="hidden md:inline">{t(key)}</span>
            {showBadge && (
              <span
                className="absolute -right-0.5 -top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-warn px-1 text-[10px] font-bold leading-tight text-black tabular-nums"
                title={t("recoveryPending", { count: recoveryPending })}
              >
                {recoveryPending}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("header");
  const lp = useLocalePath();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push(lp("/login"));
        router.refresh();
      }}
      className="ml-1 grid size-9 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-panel hover:text-danger cursor-pointer"
      title={t("logout")}
    >
      <LogOut className="size-4" />
    </button>
  );
}
