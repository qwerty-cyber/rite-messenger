// Profile.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, startAfter, onSnapshot } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
import { PollDisplay } from './PollDisplay';
import { useInfiniteQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { Post } from '../types';

export const Profile: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [friendsCount, setFriendsCount] = useState(0);
  const [polls, setPolls] = useState<any[]>([]);
  const [isBirthday, setIsBirthday] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || '');
    setAvatarPreview(user.photoURL || null);
    const loadData = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.birthday) setBirthday(data.birthday);
        if (data.username) setUsername(data.username);
      }
    };
    loadData();

    const friendsQuery = query(
      collection(db, 'friends'),
      where('participants', 'array-contains', user.uid),
      where('status', '==', 'accepted')
    );
    const unsubscribe = onSnapshot(friendsQuery, (snapshot) => setFriendsCount(snapshot.size));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'polls'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => setPolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!birthday) return;
    const today = new Date().toISOString().slice(5, 10);
    const userBD = birthday.slice(5, 10);
    setIsBirthday(today === userBD);
  }, [birthday]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
  };

  const checkUsername = async (value: string): Promise<boolean> => {
    if (!value) { setUsernameError(''); return true; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) { setUsernameError('Только латиница, цифры и _, от 3 до 20 символов'); return false; }
    const q = query(collection(db, 'usernames'), where('username', '==', value.toLowerCase()));
    const snapshot = await getDocs(q);
    if (snapshot.docs.find(doc => doc.id !== user?.uid)) { setUsernameError('Этот username уже занят'); return false; }
    setUsernameError(''); return true;
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('https://api.imgbb.com/1/upload?key=b8c24511b197ee87dab7b596a47bac90', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Ошибка загрузки');
    const data = await response.json();
    if (data.success) return data.data.url;
    throw new Error('Ошибка загрузки на ImgBB');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true); setMessage('');
    try {
      if (username && !(await checkUsername(username))) { setLoading(false); return; }
      let photoURL = user.photoURL;
      if (avatarFile) photoURL = await uploadAvatar(avatarFile);
      await updateProfile(user, { displayName, photoURL });
      await setDoc(doc(db, 'users', user.uid), {
        displayName, photoURL, email: user.email, birthday, updatedAt: new Date(),
      }, { merge: true });
      if (username) await setDoc(doc(db, 'usernames', user.uid), { username: username.toLowerCase(), userId: user.uid, updatedAt: new Date() });
      setMessage('✅ Профиль успешно обновлён!');
      setTimeout(() => { setShowEditModal(false); setMessage(''); setAvatarFile(null); }, 1000);
    } catch (error) { console.error(error); setMessage('❌ Ошибка при обновлении профиля'); }
    finally { setLoading(false); }
  };

  const fetchUserPosts = async ({ pageParam = null }: { pageParam?: any }) => {
    if (!user) return { posts: [], nextPage: null };
    const postsPerPage = 10;
    let q = query(collection(db, 'posts'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc'), limit(postsPerPage));
    if (pageParam) q = query(collection(db, 'posts'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc'), startAfter(pageParam), limit(postsPerPage));
    const snapshot = await getDocs(q);
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    const posts: Post[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, channel: { id: data.authorId, name: data.authorName || 'Пользователь', avatar: data.authorPhotoURL || null }, text: data.text || '', publishedAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(), media: data.media || [], likes: data.likes || [], commentsCount: data.commentsCount || 0, shares: 0, pinned: data.pinned || false };
    });
    return { posts, nextPage: lastVisible };
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: postsLoading } = useInfiniteQuery({
    queryKey: ['user-posts', user?.uid], queryFn: fetchUserPosts, getNextPageParam: (lastPage) => lastPage.nextPage, initialPageParam: null, enabled: !!user,
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastPostRef = useCallback((node: HTMLDivElement | null) => {
    if (postsLoading || isFetchingNextPage) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && hasNextPage) fetchNextPage(); });
    if (node) observerRef.current.observe(node);
  }, [postsLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  if (!user) return null;

  const postItems = (data?.pages.flatMap(page => page.posts) || []).map(post => ({ id: post.id, type: 'post' as const, postData: post, createdAt: new Date(post.publishedAt) }));
  const pollItems = polls.map(poll => ({ id: poll.id, type: 'poll' as const, pollData: poll, createdAt: poll.createdAt?.toDate() || new Date() }));
  const allItems = [...postItems, ...pollItems]
    .filter((item, index, self) => self.findIndex(t => t.id === item.id && t.type === item.type) === index)
    .sort((a, b) => {
      const aPinned = a.type === 'post' ? (a.postData as any).pinned : false;
      const bPinned = b.type === 'post' ? (b.postData as any).pinned : false;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white/5 backdrop-blur-xl border-b border-[var(--border-color)] p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <Avatar src={avatarPreview} name={displayName} size="lg" />
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  {displayName || 'Пользователь'}
                  {isBirthday && <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full">🎂 Сегодня ДР!</span>}
                </h2>
                {username && <p className="text-[var(--text-secondary)]">@{username}</p>}
                <p className="text-sm text-[var(--text-secondary)] mt-1">{friendsCount} друзей</p>
              </div>
            </div>
            <button onClick={() => setShowEditModal(true)} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-[var(--text-primary)] rounded-xl text-xs sm:text-sm font-medium transition-colors">Редактировать</button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {postsLoading ? (
            <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="glass-heavy p-4 rounded-2xl animate-pulse"><div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-white/10" /><div className="flex-1"><div className="h-4 w-24 bg-white/10 rounded mb-2" /><div className="h-3 w-16 bg-white/10 rounded" /></div></div></div>)}</div>
          ) : allItems.length === 0 ? (
            <div className="text-center text-[var(--text-secondary)] py-8">У вас пока нет постов.</div>
          ) : (
            <>
              {allItems.map((item, index) => {
                const isLast = index === allItems.length - 1;
                if (item.type === 'poll') return <div key={`poll-${item.id}`} className="mb-4"><PollDisplay pollId={item.id} /></div>;
                return <div key={item.id} ref={isLast ? lastPostRef : undefined} className="mb-4"><PostCard post={item.postData} /></div>;
              })}
              {isFetchingNextPage && <div className="glass-heavy p-4 rounded-2xl animate-pulse"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/10" /><div className="h-4 w-24 bg-white/10 rounded" /></div></div>}
            </>
          )}
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Редактировать профиль</h3>
              <button onClick={() => { setShowEditModal(false); setMessage(''); setAvatarFile(null); setAvatarPreview(user.photoURL || null); setDisplayName(user.displayName || ''); }} className="p-1 rounded-full hover:bg-white/10 text-[var(--text-secondary)]"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Фото профиля</label><div className="flex items-center gap-4"><Avatar src={avatarPreview} name={displayName} size="md" /><label className="cursor-pointer bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm text-[var(--text-primary)]">Выбрать фото<input type="file" accept="image/*" className="hidden" onChange={handleFileChange} /></label></div></div>
              <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Имя</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-3 bg-white/10 rounded-xl text-[var(--text-primary)]" /></div>
              <div><label className="block text-sm text-[var(--text-secondary)] mb-1">@username</label><input type="text" value={username} onChange={async (e) => { const val = e.target.value.toLowerCase(); setUsername(val); await checkUsername(val); }} className={`w-full px-4 py-3 bg-white/10 rounded-xl text-[var(--text-primary)] ${usernameError ? 'border border-red-500' : ''}`} />{usernameError && <div className="text-red-400 text-sm mt-1">{usernameError}</div>}</div>
              <div><label className="block text-sm text-[var(--text-secondary)] mb-1">День рождения</label><input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full px-4 py-3 bg-white/10 rounded-xl text-[var(--text-primary)]" /></div>
              <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Email</label><input type="email" value={user.email || ''} disabled className="w-full px-4 py-3 bg-white/5 rounded-xl text-[var(--text-secondary)]" /></div>
              {message && <div className="text-sm text-[var(--text-primary)]">{message}</div>}
              <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium text-white disabled:opacity-50">{loading ? 'Сохранение...' : 'Сохранить изменения'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};