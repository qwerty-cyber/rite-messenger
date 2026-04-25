// Bookmarks.tsx
import React, { useEffect, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { PostCard } from './PostCard';
import type { Post } from '../types';

export const Bookmarks: React.FC = () => {
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'bookmarks'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const posts = snapshot.docs
          .map(doc => {
            const data = doc.data();
            if (data.post && data.post.id) {
              return { ...data.post, bookmarkId: doc.id } as Post & { bookmarkId: string };
            }
            return null;
          })
          .filter(Boolean);
        setBookmarkedPosts(posts as any[]);
        setLoading(false);
      },
      (error) => {
        console.error('Ошибка загрузки закладок:', error);
        setBookmarkedPosts([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 glass-heavy border-b border-[var(--border-color)]">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Закладки</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {loading ? (
            <div className="text-center text-[var(--text-secondary)] py-8">Загрузка...</div>
          ) : bookmarkedPosts.length === 0 ? (
            <div className="text-center text-[var(--text-secondary)] py-8">Нет сохранённых постов</div>
          ) : (
            bookmarkedPosts.map(post => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};