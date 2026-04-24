// PublicProfile.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, startAfter, getDocs, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
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
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!userId) return;
    const loadUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) setUserData(userDoc.data());
        else { navigate('/'); return; }

        const usernameDoc = await getDoc(doc(db, 'usernames', userId));
        if (usernameDoc.exists()) setUsername(usernameDoc.data().username);

        // Проверяем статус дружбы
        if (currentUser && currentUser.uid !== userId) {
          const friendsQuery = query(
            collection(db, 'friends'),
            where('participants', 'array-contains', currentUser.uid)
          );
          const friendsSnap = await getDocs(friendsQuery);
          const existingRequest = friendsSnap.docs.find(doc => {
            const data = doc.data();
            return data.participants.includes(userId);
          });

          if (existingRequest) {
            const data = existingRequest.data();
            setFriendStatus(data.status);
            setFriendRequestId(existingRequest.id);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [userId, navigate, currentUser]);

  const handleFriendAction = async () => {
    if (!currentUser || !userId) return;

    if (friendStatus === 'none') {
      // Отправляем заявку
      const ref = await addDoc(collection(db, 'friends'), {
        requesterId: currentUser.uid,
        receiverId: userId,
        status: 'pending',
        participants: [currentUser.uid, userId],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      setFriendStatus('pending');
      setFriendRequestId(ref.id);
    } else if (friendStatus === 'accepted') {
      // Удаляем из друзей
      if (friendRequestId) {
        await updateDoc(doc(db, 'friends', friendRequestId), {
          status: 'removed',
          updatedAt: Timestamp.now()
        });
      }
      setFriendStatus('none');
      setFriendRequestId(null);
    }
  };

  // ... (fetchUserPosts остаётся без изменений)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        Загрузка...
      </div>
    );
  }

  if (!userData) return null;

  const isOwnProfile = currentUser?.uid === userId;

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-[#AAAAAA] hover:text-white p-2 rounded-lg hover:bg-white/10"
          >
            <ArrowLeft size={20} />
            <span>Назад</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Avatar src={userData.photoURL} name={userData.displayName} size="lg" />
              <div>
                <h2 className="text-2xl font-bold">{userData.displayName || 'Пользователь'}</h2>
                {username && <p className="text-[#AAAAAA]">@{username}</p>}
              </div>
            </div>
            {!isOwnProfile && (
              <button
                onClick={handleFriendAction}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  friendStatus === 'accepted'
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : friendStatus === 'pending'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                }`}
              >
                {friendStatus === 'accepted' ? (
                  <><UserCheck size={18} /> В друзьях</>
                ) : friendStatus === 'pending' ? (
                  <><Clock size={18} /> Заявка отправлена</>
                ) : (
                  <><UserPlus size={18} /> Добавить в друзья</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Список постов (оставь как было) */}
    </div>
  );
};