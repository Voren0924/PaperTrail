"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { getProviderSettings } from "@/lib/settingsApi";

import { ErrorState, LoadingState } from "./StateViews";

export function SetupGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [check, setCheck] = useState<{ pathname: string; state: "ready" | "error" } | null>(null);
  const isSettingsPath = pathname.startsWith("/settings");

  useEffect(() => {
    if (isSettingsPath) {
      return;
    }

    let ignore = false;

    getProviderSettings()
      .then((response) => {
        if (ignore) {
          return;
        }

        if (!response.settings.isComplete) {
          router.replace("/settings");
          return;
        }

        setCheck({ pathname, state: "ready" });
      })
      .catch(() => {
        if (!ignore) {
          setCheck({ pathname, state: "error" });
        }
      });

    return () => {
      ignore = true;
    };
  }, [isSettingsPath, pathname, router]);

  if (isSettingsPath) {
    return <>{children}</>;
  }

  const state = check?.pathname === pathname ? check.state : "loading";

  if (state === "loading") {
    return <LoadingState label="Checking local provider settings..." />;
  }

  if (state === "error") {
    return <ErrorState message="Unable to load local provider settings." />;
  }

  return <>{children}</>;
}
