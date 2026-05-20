"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMe, logout } from "@/lib/authApi";
import type { CurrentUser } from "@/lib/types";

import { Button } from "./Button";

export function AppNav() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let ignore = false;

    getMe()
      .then((response) => {
        if (!ignore) {
          setUser(response.user);
        }
      })
      .catch(() => {
        if (!ignore) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [pathname]);

  async function handleLogout() {
    await logout();
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  if (isLoading) {
    return (
      <nav className="nav" aria-label="Primary navigation">
        <span>Checking session</span>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="nav" aria-label="Primary navigation">
        <Link href="/login">Log in</Link>
        <Link className="button button--secondary" href="/register">
          Register
        </Link>
      </nav>
    );
  }

  return (
    <nav className="nav" aria-label="Primary navigation">
      <Link href="/papers">Papers</Link>
      <Link href="/papers/new">Upload</Link>
      <span className="nav-user">{user.email}</span>
      <Button variant="ghost" onClick={() => void handleLogout()}>
        Log out
      </Button>
    </nav>
  );
}
