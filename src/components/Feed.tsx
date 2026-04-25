// Feed.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PostCard } from "./PostCard";
import { CreatePostBar } from "./CreatePostBar";
import { PollDisplay } from "./PollDisplay";
import { usePosts } from "../hooks/usePosts";
import { db } from "../lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

type FeedTab = "subscriptions" | "recommendations";

export const Feed: React.FC = () => {
  const [activeTab] = useState<FeedTab>("subscriptions");
  const [polls, setPolls] = useState<any[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = usePosts(activeTab);

  useEffect(() => {
    const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => setPolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubscribe();
  }, []);

  // Отслеживаем скролл для кнопки "Наверх"
  const handleScroll = () => {
    const scrollY = feedRef.current?.scrollTop || 0;
    setShowScrollTop(scrollY > 500);
  };

  useEffect(() => {
    feedRef.current?.addEventListener('scroll', handleScroll);
    return () => feedRef.current?.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) fetchNextPage();
      });
      if (node) observerRef.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  const allPosts = data?.pages.flatMap(page => page.posts) || [];
  const pollItems = polls.map(poll => ({ id: poll.id, isPoll: true, createdAt: poll.createdAt?.toDate() || new Date() }));
  const postItems = allPosts.map(post => ({ id: post.id, isPoll: false, postData: post, createdAt: new Date(post.publishedAt) }));
  const allItems = [...pollItems, ...postItems].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="flex flex-col h-full relative">
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {isLoading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-heavy p-4 rounded-2xl animate-pulse">
                  <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-white/10" /><div className="flex-1"><div className="h-4 w-24 bg-white/10 rounded mb-2" /><div className="h-3 w-16 bg-white/10 rounded" /></div></div>
                  <div className="space-y-2"><div className="h-4 w-full bg-white/10 rounded" /><div className="h-4 w-3/4 bg-white/10 rounded" /></div>
                </div>
              ))}
            </>
          ) : isError ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">Ошибка загрузки</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="space-y-4">
                {allItems.map((item, index) => {
                  const isLast = index === allItems.length - 1;
                  if (item.isPoll) return <div key={`poll-${item.id}`}><PollDisplay pollId={item.id} /></div>;
                  return <div key={item.id} ref={isLast ? lastPostRef : undefined}><PostCard post={item.postData} /></div>;
                })}
                {allItems.length === 0 && <div className="text-center py-8 text-[var(--text-secondary)]">Пока нет постов. Будьте первым!</div>}
              </motion.div>
            </AnimatePresence>
          )}
          {isFetchingNextPage && (
            <div className="glass-heavy p-4 rounded-2xl animate-pulse">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/10" /><div className="h-4 w-24 bg-white/10 rounded" /></div>
            </div>
          )}
        </div>
      </div>

      <CreatePostBar />

      {/* Кнопка "Наверх" */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-4 z-50 p-3 bg-accent text-white rounded-full shadow-xl hover:bg-[var(--accent-hover)] transition-all animate-bounce"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
        </button>
      )}
    </div>
  );
};