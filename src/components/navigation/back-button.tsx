"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type BackButtonProps = {
  fallbackHref: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function BackButton({
  fallbackHref,
  label = "Back",
  className,
  variant = "ghost",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window === "undefined") {
      router.push(fallbackHref);
      return;
    }

    const hasHistoryEntry = window.history.length > 1;
    const currentLocation = `${window.location.pathname}${window.location.search}`;
    const referrer = document.referrer;

    if (hasHistoryEntry && referrer) {
      try {
        const referrerUrl = new URL(referrer);
        const referrerLocation = `${referrerUrl.pathname}${referrerUrl.search}`;

        if (referrerUrl.origin === window.location.origin && referrerLocation !== currentLocation) {
          router.back();
          return;
        }
      } catch {
        // Fall back to the configured route when referrer parsing is unreliable.
      }
    }

    router.push(fallbackHref);
  };

  return (
    <Button className={className} onClick={handleBack} type="button" variant={variant}>
      {label}
    </Button>
  );
}
