import Image from "next/image";

import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  darkSrc?: string;
  imageClassName?: string;
  lightSrc?: string;
  priority?: boolean;
};

export function AppLogo({
  className,
  darkSrc = "/branding/asset-tracker-logo-dark-transparent.png",
  imageClassName,
  lightSrc = "/branding/asset-tracker-logo-light-transparent.png",
  priority = false,
}: AppLogoProps) {
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)} aria-label="IT Asset Tracker">
      <Image
        alt="IT Asset Tracker"
        className={cn("block h-full w-full object-contain dark:hidden", imageClassName)}
        height={1024}
        priority={priority}
        src={lightSrc}
        width={1024}
      />
      <Image
        alt=""
        aria-hidden="true"
        className={cn("hidden h-full w-full object-contain dark:block", imageClassName)}
        height={1024}
        priority={priority}
        src={darkSrc}
        width={1024}
      />
    </span>
  );
}
