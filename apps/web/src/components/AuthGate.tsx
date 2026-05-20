"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { getMe } from "@/lib/authApi";
import type { CurrentUser } from "@/lib/types";

import { Alert } from "./Alert";
import { LoadingState } from "./StateViews";

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  }, []);

  if (isLoading) {
    return <LoadingState label="Checking your session..." />;
  }

  if (!user) {
    return (
      <Alert tone="warning" title="Sign in required">
        <p>You need to log in before viewing or uploading papers.</p>
        <Link className="button button--primary" href="/login">
          Log in
        </Link>
      </Alert>
    );
  }

  return <>{children}</>;
}
