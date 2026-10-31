"use client";

import React from "react";
import pkg from "../../../package.json";
import styles from "./styles.module.css";

export default function DebugBar() {
  return (
    <aside className={styles.versionBadge} aria-label="App Version">
      <span>v{pkg.version}</span>
    </aside>
  );
}
