import React from "react";
import { playBeep } from "@/utils/audio";
import styles from "./styles.module.css";

interface TagProps {
  tag: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

export default function Tag({ tag, count, isActive, onClick }: TagProps) {
  return (
    <button
      onClick={() => {
        playBeep(400, 0.05, "sine");
        onClick();
      }}
      className={`${styles.widgetTagBtn} ${isActive ? styles.widgetTagActive : ""}`}
    >
      #{tag} ({count})
    </button>
  );
}
