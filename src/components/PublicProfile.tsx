// PublicProfile.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, startAfter, getDocs, addDoc, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
import { PollDisplay } from './PollDisplay';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft, UserPlus, UserCheck, Clock } from 'lucide-react';
import type { Post } from '../types';

export const PublicProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [friendRequestId, setFriendRequestId] = useState<string | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [polls, setPolls] = useState<any[]>([]);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!userId) return;
    const loadUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) setUserData(userDoc.data()); else { navigate('/'); return; }
        const usernameDoc = await getDoc(doc(db, 'usernames', userId));
        if (usernameDoc.exists()) setUsername(usernameDoc.data().username);

        if (currentUser && currentUser.uid !== userId) {
          const friendsQuery = query(collection(db, 'friends'), where('participants', 'array-contains', currentUser.uid));
          const friendsSnap = await getDocs(friendsQuery);
          const existingRequest = friendsSnap.docs.find(doc => { const data = doc.data(); return data.participants.includes(userId); });
          if (existingRequest) { const data = existingRequest.data(); setFriendStatus(data.status); setFriendRequestId(existingRequest.id); }
        }

        const q = query(collection(db, 'friends'), where('participants', 'array-contains', userId), where('status', '==', 'accepted'));
        const unsubscribe = onSnapshot(q, (snapshot) => setFriendsCount(snapshot.size));

        const pollsQuery = query(collection(db, 'polls'), where('createdBy', '==', userId), orderBy('createdAt', 'desc'));
        const unsubscribePolls = onSnapshot(pollsQuery, (snapshot) => setPolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

        return () => { unsubscribe(); unsubscribePolls(); };
      } catch (error) { console.error('Ошибка загрузки профиля:', error); } finally { setLoading(false); }
    };
    loadUser();
  }, [userId, navigate, currentUser]);

  const handleFriendAction = async () => {
    if (!currentUser || !userId) return;
    if (friendStatus === 'none') {
      const ref = await addDoc(collection(db, 'friends'), { requesterId: currentUser.uid, receiverId: userId, status: 'pending', participants: [currentUser.uid, userId], createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      setFriendStatus('pending'); setFriendRequestId(ref.id);
    } else if (friendStatus === 'accepted') {
      if (friendRequestId) await updateDoc(doc(db, 'friends', friendRequestId), { status: 'removed', updatedAt: Timestamp.now() });
      setFriendStatus('none'); setFriendRequestId(null);
    }
  };

  const fetchUserPosts = async ({ pageParam = null }: { pageParam?: any }) => {
    if (!userId) return { posts: [], nextPage: null };
    const postsPerPage = 10;
    let q = query(collection(db, 'posts'), where('authorId', '==', userId), orderBy('createdAt', 'desc'), limit(postsPerPage));
    if (pageParam) q = query(collection(db, 'posts'), where('authorId', '==', userId), orderBy('createdAt', 'desc'), startAfter(pageParam), limit(postsPerPage));
    const snapshot = await getDocs(q);
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    const posts: Post[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, channel: { id: data.authorId, name: data.authorName || 'Пользователь', avatar: data.authorPhotoURL || null }, text: data.text || '', publishedAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(), media: data.media || [], likes: data.likes || [], commentsCount: data.commentsCount || 0, shares: 0, pinned: data.pinned || false };
    });
    return { posts, nextPage: lastVisible };
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: postsLoading } = useInfiniteQuery({ queryKey: ['user-posts', userId], queryFn: fetchUserPosts, getNextPageParam: (lastPage) => lastPage.nextPage, initialPageParam: null, enabled: !!userId });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastPostRef = useCallback((node: HTMLDivElement | null) => {
    if (postsLoading || isFetchingNextPage) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && hasNextPage) fetchNextPage(); });
    if (node) observerRef.current.observe(node);
  }, [postsLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  if (loading) return <div className="flex items-center justify-center h-full text-[var(--text-primary)]">Загрузка...</div>;
  if (!userData) return null;

  const postItems = (data?.pages.flatMap(page => page.posts) || []).map(post => ({ id: post.id, type: 'post' as const, postData: post, createdAt: new Date(post.publishedAt) }));
  const pollItems = polls.map(poll => ({ id: poll.id, type: 'poll' as const, pollData: poll, createdAt: poll.createdAt?.toDate() || new Date() }));

  const allItems = [...postItems, ...pollItems].sort((a, b) => {
    const aPinned = a.type === 'post' ? (a.postData as any).pinned : false;
    const bPinned = b.type === 'post' ? (b.postData as any).pinned : false;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const isOwnProfile = currentUser?.uid === userId;

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 bg-white/5 backdrop-blur-xl border-b border-[var(--border-color)]">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded-lg hover:bg-white/10"><ArrowLeft size={20} /><span>Назад</span></button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Avatar src={userData.photoURL} name={userData.displayName} size="lg" />
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{userData.displayName || 'Пользователь'}</h2>
                {username && <p className="text-[var(--text-secondary)]">@{username}</p>}
                <p className="text-sm text-[var(--text-secondary)]">{friendsCount} друзей</p>
              </div>
            </div>
            {!isOwnProfile && (
              <button onClick={handleFriendAction} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${friendStatus === 'accepted' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : friendStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}>
                {friendStatus === 'accepted' ? <><UserCheck size={18} /> В друзьях</> : friendStatus === 'pending' ? <><Clock size={18} /> Заявка отправлена</> : <><UserPlus size={18} /> Добавить в друзья</>}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {postsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass p-4 rounded-2xl animate-pulse"><div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-white/10" /><div className="flex-1"><div className="h-4 w-24 bg-white/10 rounded mb-2" /><div className="h-3 w-16 bg-white/10 rounded" /></div></div></div>
              ))}
            </div>
          ) : allItems.length === 0 ? (
            <div className="text-center text-[var(--text-secondary)] py-8">У пользователя пока нет постов.</div>
          ) : (
            <>
              {allItems.map((item, index) => {
                const isLast = index === allItems.length - 1;
                if (item.type === 'poll') return <div key={`poll-${item.id}`} className="mb-4"><PollDisplay pollId={item.id} /></div>;
                return <div key={item.id} ref={isLast ? lastPostRef : undefined} className="mb-4"><PostCard post={item.postData} /></div>;
              })}
              {isFetchingNextPage && <div className="glass p-4 rounded-2xl animate-pulse"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/10" /><div className="h-4 w-24 bg-white/10 rounded" /></div></div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};