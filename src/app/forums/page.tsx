"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import styles from "./styles.module.css";
import { useAuth } from "@/utils/AuthContext";
import { fetchPosts, ForumPost } from "@/utils/firebase";
import { playBeep, playCoin } from "@/utils/audio";
import PostCard from "@/components/PostCard";
import SidebarWidgetPanel from "@/components/SidebarWidgetPanel";
import PostCreationModal from "@/components/PostCreationModal";

export default function ForumsPage() {
  const { user, login } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "news" | "forum">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch only posts on mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const postsList = await fetchPosts();
        setPosts(postsList);
      } catch (err) {
        console.error("Error loading forums posts:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  // Compile list of all distinct tags in current posts for the sidebar
  const allDistinctTags = Array.from(
    new Set(posts.flatMap((p) => p.tags || [])),
  ).sort();

  // Filter posts based on tab, search query, and tag selections
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || post.type === activeTab;
    const matchesTag =
      !selectedTag || (post.tags && post.tags.includes(selectedTag));
    return matchesSearch && matchesTab && matchesTag;
  });

  return (
    <CRTOverlay>
      <div className={styles.container}>
        {/* Navigation Breadcrumb */}
        <Link
          href="/"
          className={styles.backLink}
          onClick={() => playBeep(200, 0.1, "sine")}
        >
          ◀ BACK
        </Link>

        {/* Header bar */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>BBS FORUMS & NEWS</h1>
            <p className="text-xs text-[#a0a0c0] mt-1 font-mono tracking-wider">
              RETRO DIGITAL COMMUNITY ARCHIVE SYSTEM v2.0
            </p>
          </div>
          <div className={styles.headerActions}>
            {user ? (
              <button
                onClick={() => {
                  playBeep(440, 0.15, "triangle");
                  setIsModalOpen(true);
                }}
                className={styles.actionBtnYellow}
              >
                📝 CREATE THREAD
              </button>
            ) : (
              <button
                onClick={() => {
                  playCoin();
                  login();
                }}
                className={styles.actionBtn}
              >
                🔐 LOGIN GOOGLE TO POST
              </button>
            )}
          </div>
        </header>

        {/* Filters Panel */}
        <div className={styles.filterRow}>
          <div className={styles.tabGroup}>
            <button
              onClick={() => {
                playBeep(600, 0.05, "sine");
                setActiveTab("all");
              }}
              className={`${styles.tabBtn} ${activeTab === "all" ? styles.tabBtnActive : ""}`}
            >
              ALL POSTS
            </button>
            <button
              onClick={() => {
                playBeep(600, 0.05, "sine");
                setActiveTab("news");
              }}
              className={`${styles.tabBtn} ${activeTab === "news" ? styles.tabBtnActive : ""}`}
            >
              📢 NEWS / EVENTS
            </button>
            <button
              onClick={() => {
                playBeep(600, 0.05, "sine");
                setActiveTab("forum");
              }}
              className={`${styles.tabBtn} ${activeTab === "forum" ? styles.tabBtnActive : ""}`}
            >
              💬 DISCUSSIONS
            </button>
          </div>

          <div className={styles.searchBar}>
            <input
              type="text"
              placeholder="SEARCH TOPICS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.searchIcon}>🔍</div>
          </div>
        </div>

        {/* Content Section */}
        <div className={styles.board}>
          {/* Main Feed */}
          <div>
            {loading ? (
              <div className="text-center font-pixel text-xs text-[#a0a0c0] py-16 animate-pulse select-none">
                CONNECTING BBS TERMINAL...
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center text-slate-500 font-pixel text-[11px] border border-dashed border-slate-800 py-16 uppercase">
                NO THREADS FOUND
              </div>
            ) : (
              <div className={styles.postList}>
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar widget panel */}
          <SidebarWidgetPanel
            posts={posts}
            allDistinctTags={allDistinctTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
          />
        </div>

        {/* POST CREATION MODAL */}
        {isModalOpen && (
          <PostCreationModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={(newPost) => setPosts((prev) => [newPost, ...prev])}
          />
        )}
      </div>
    </CRTOverlay>
  );
}
