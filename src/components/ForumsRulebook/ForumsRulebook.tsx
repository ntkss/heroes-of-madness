import React from "react";
import styles from "./styles.module.css";

export default function ForumsRulebook() {
  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>SYSTEM PROTOCOLS</h3>
      <ul className="text-xs text-slate-400 space-y-2 font-mono list-disc list-inside">
        <li>ONLY LOGGED-IN USERS CAN OPEN THREADS.</li>
        <li>POSTS WILL BE AUTOMATICALLY INDEXED BY CORE TOPICS.</li>
        <li>INJECT PLAYER MENTIONS WITH @player:NAME.</li>
        <li>INJECT MATCH PROFILE BADGES WITH @match:ID.</li>
        <li>COMMUNITY ETIQUETTE MANDATORY. NO SENSELESS HATE.</li>
      </ul>
    </div>
  );
}
