"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, Plus, History, UserCircle, Users } from "lucide-react";
import { cls } from "./ui";

const links = [
  { href: "/", key: "new", icon: Plus },
  { href: "/pushes", key: "history", icon: History },
  { href: "/account", key: "account", icon: UserCircle },
] as const;

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("header.nav");
  const all = isAdmin
    ? [...links, { href: "/admin", key: "admin", icon: Users } as const]
    : links;
  return (
    <nav className="flex items-center gap-1">
      {all.map(({ href, key, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cls(
              "flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm transition-colors sm:px-3",
              active
                ? "bg-accent/15 text-accent-soft"
                : "text-ink-dim hover:bg-panel hover:text-ink"
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("header");
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="ml-1 grid size-9 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-panel hover:text-danger cursor-pointer"
      title={t("logout")}
    >
      <LogOut className="size-4" />
    </button>
  );
}
