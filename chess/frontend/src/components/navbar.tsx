"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { ChanakyaLogo } from "@/components/chanakya-logo";
import { useAuthStore } from "@/store/auth";

const NAV_LINKS = [
  { href: "/play",    label: "Play" },
  { href: "/learn",   label: "Learn" },
  { href: "/puzzles", label: "Puzzles" },
];

export function Navbar() {
  const { isAuthenticated, email, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-DEFAULT/90 backdrop-blur">
      <nav className="container-px flex h-16 items-center gap-6">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <ChanakyaLogo size={34} />
          <span className="text-lg font-bold tracking-tight text-white">
            Chanakya
          </span>
        </Link>

        {/* Nav links — centre */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/8 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right side — push to end */}
        <div className="ml-auto flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Avatar chip */}
              <div className="hidden items-center gap-2 sm:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-sm font-bold text-brand">
                  {email?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <Link
                href="/settings"
                title="Settings"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-400 transition hover:bg-white/8 hover:text-white"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:block">Settings</span>
              </Link>
              <button
                onClick={logout}
                title="Logout"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/8 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
              <Link href="/play" className="btn-primary text-sm">
                Play Now
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm text-gray-300 hover:text-white sm:block"
              >
                Login
              </Link>
              <Link href="/login?mode=register" className="btn-primary text-sm">
                Register Free
              </Link>
            </>
          )}
        </div>

      </nav>
    </header>
  );
}
