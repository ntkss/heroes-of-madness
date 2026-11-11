import React from "react";
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
      onClick={onClick}
      className={`${styles.widgetTagBtn} ${isActive ? styles.widgetTagActive : ""}`}
    >
      #{tag} ({count})
    </button>
  );
}
