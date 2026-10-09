"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { playBeep } from "@/utils/audio";
import styles from "./styles.module.css";

interface NavLinkItem {
  name: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavLinkItem[] = [
  { name: "Arena", href: "/", icon: "⚔️" },
  { name: "Winner", href: "/hall-of-fame", icon: "👑" },
  { name: "Seasons", href: "/seasons", icon: "🏆" },
  { name: "Forums", href: "/forums", icon: "💬" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

export default function GlassNavbar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNav} aria-label="Mobile Navigation">
      <div className={styles.glassContainer}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                playBeep(isActive ? 440 : 330, 0.08, "triangle");
              }}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.name}</span>
              {isActive && <span className={styles.activeGlowDot} />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
