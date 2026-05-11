"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

type SponsorActionLinkProps = {
  children: ReactNode;
  className: string;
};

function isMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(
    navigator.userAgent,
  );
}

export function SponsorActionLink({
  children,
  className,
}: SponsorActionLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!isMobileBrowser()) {
      return;
    }

    event.preventDefault();
    window.location.href = "/sponsor/mini-program-jump";
  }

  return (
    <Link href="/sponsor" onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
