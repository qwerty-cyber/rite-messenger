// Feed.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PostCard } from "./PostCard";
import { CreatePostBar } from "./CreatePostBar";
import { usePosts } from "../hooks/usePosts";
import { auth } from "../lib/firebase";

type FeedTab = "subscriptions" | "recommendations";

export const Feed: React.FC = () => {
  const [activeTab] = useState<FeedTab>("subscriptions");
  const observerRef = useRef<IntersectionObserver | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    usePosts(activeTab);

  // Вывод uid текущего пользователя в консоль (можно удалить после использования)
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      console.log('Мой uid:', user.uid);
    }
  }, []);

  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Прокручиваемая область с постами */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {isLoading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-white/10" />
                    <div className="flex-1">
                      <div className="h-4 w-24 bg-white/10 rounded mb-2" />
                      <div className="h-3 w-16 bg-white/10 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-white/10 rounded" />
                    <div className="h-4 w-3/4 bg-white/10 rounded" />
                  </div>
                </div>
              ))}
            </>
          ) : isError ? (
            <div className="text-center py-8 text-[#AAAAAA]">Ошибка загрузки</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {data?.pages.map((page, pageIndex) => (
                  <React.Fragment key={pageIndex}>
                    {page.posts.map((post, index) => {
                      const isLast = pageIndex === data.pages.length - 1 && index === page.posts.length - 1;
                      return (
                        <div key={post.id} ref={isLast ? lastPostRef : undefined}>
                          <PostCard post={post} />
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {isFetchingNextPage && (
            <div className="bg-white/5 rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="h-4 w-24 bg-white/10 rounded" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Нижняя панель создания поста */}
      <CreatePostBar />
    </div>
  );
};