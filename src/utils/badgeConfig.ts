"use client";

import { useState, useEffect } from "react";
import {
  BadgeConfig,
  DEFAULT_BADGE_CONFIG,
  fetchBadgeConfig,
  getBadgeConfigSync,
  saveBadgeConfig,
} from "./firebase";

export type { BadgeConfig, BadgeItemConfig } from "./firebase";
export {
  DEFAULT_BADGE_CONFIG,
  fetchBadgeConfig,
  getBadgeConfigSync,
  saveBadgeConfig,
};

/**
 * Custom React hook to subscribe to and access custom badge configuration.
 * Automatically synchronizes across tabs and component updates via event listeners.
 */
export function useBadgeConfig(): BadgeConfig {
  const [badgeConfig, setBadgeConfig] = useState<BadgeConfig>(() =>
    getBadgeConfigSync(),
  );

  useEffect(() => {
    let isMounted = true;
    fetchBadgeConfig().then((cfg) => {
      if (isMounted) {
        setBadgeConfig(cfg);
      }
    });

    const handleUpdate = () => {
      setBadgeConfig(getBadgeConfigSync());
    };

    window.addEventListener("badge-config-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("badge-config-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return badgeConfig;
}
