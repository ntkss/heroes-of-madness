import React from "react";
import Tag from "../Tag";
import ForumsRulebook from "../ForumsRulebook";
import { ForumPost } from "@/utils/firebase";
import { playBeep } from "@/utils/audio";
import styles from "./styles.module.css";

interface SidebarWidgetPanelProps {
  posts: ForumPost[];
  allDistinctTags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export default function SidebarWidgetPanel({
  posts,
  allDistinctTags,
  selectedTag,
  onSelectTag,
}: SidebarWidgetPanelProps) {
  return (
    <div className={styles.sidebar}>
      {/* Tag groupings cloud widget */}
      <div className={styles.widget}>
        <h3 className={styles.widgetTitle}>TAG GROUPINGS</h3>
        <div className={styles.widgetTagsList}>
          <button
            onClick={() => {
              playBeep(400, 0.05, "sine");
              onSelectTag(null);
            }}
            className={`${styles.widgetTagBtn} ${!selectedTag ? styles.widgetTagActive : ""}`}
          >
            #ALL-TAGS ({posts.length})
          </button>
          {allDistinctTags.map((tag) => {
            const count = posts.filter((p) => p.tags.includes(tag)).length;
            return (
              <Tag
                key={tag}
                tag={tag}
                count={count}
                isActive={selectedTag === tag}
                onClick={() => onSelectTag(tag)}
              />
            );
          })}
        </div>
      </div>

      {/* Forums Rulebook protocol widget */}
      {/* <ForumsRulebook /> */}
    </div>
  );
}
