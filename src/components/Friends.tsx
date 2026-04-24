// Friends.tsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, onSnapshot, addDoc } from 'firebase/firestore';
import { Avatar } from './Avatar';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Clock } from 'lucide-react';

export const Friends: React.FC = () => {
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const friendsQuery = query(
      collection(db, 'friends'),
      where('status', '==', 'accepted'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(friendsQuery, async (snapshot) => {
      const friendsData = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const friendId = data.requesterId === currentUser.uid ? data.receiverId : data.requesterId;
          const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', friendId)));
          if (!userDoc.empty) {
            return { id: doc.id, ...data, friendData: userDoc.docs[0].data(), friendId };
          }
          return null;
        })
      );
      setFriends(friendsData.filter(Boolean));
    });

    const requestsQuery = query(
      collection(db, 'friends'),
      where('receiverId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribeRequests = onSnapshot(requestsQuery, async (snapshot) => {
      const requestsData = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', data.requesterId)));
          if (!userDoc.empty) {
            return { id: doc.id, ...data, requesterData: userDoc.docs[0].data() };
          }
          return null;
        })
      );
      setRequests(requestsData.filter(Boolean));
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeRequests();
    };
  }, [currentUser]);

  const acceptRequest = async (requestId: string) => {
    await updateDoc(doc(db, 'friends', requestId), {
      status: 'accepted',
      updatedAt: Timestamp.now()
    });
  };

  const rejectRequest = async (requestId: string) => {
    await updateDoc(doc(db, 'friends', requestId), {
      status: 'rejected',
      updatedAt: Timestamp.now()
    });
  };

  const removeFriend = async (friendId: string) => {
    if (!window.confirm('Удалить из друзей?')) return;
    await updateDoc(doc(db, 'friends', friendId), {
      status: 'removed',
      updatedAt: Timestamp.now()
    });
  };

  const handleWriteMessage = async (friendId: string) => {
    if (!currentUser) return;

    // Ищем существующий чат
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );
    const chatsSnapshot = await getDocs(chatsQuery);
    const existingChat = chatsSnapshot.docs.find(doc => {
      const data = doc.data();
      return data.participants.includes(friendId);
    });

    if (existingChat) {
      navigate(`/messages/${existingChat.id}`);
    } else {
      // Создаём новый чат
      const newChat = await addDoc(collection(db, 'chats'), {
        participants: [currentUser.uid, friendId],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      navigate(`/messages/${newChat.id}`);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">Друзья</h1>
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'friends'
                  ? 'bg-blue-500/30 text-blue-400'
                  : 'text-[#AAAAAA] hover:text-white hover:bg-white/5'
              }`}
            >
              <UserCheck size={18} className="inline mr-2" />
              Друзья ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'requests'
                  ? 'bg-blue-500/30 text-blue-400'
                  : 'text-[#AAAAAA] hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={18} className="inline mr-2" />
              Заявки ({requests.length})
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {activeTab === 'friends' ? (
            friends.length === 0 ? (
              <div className="text-center text-[#AAAAAA] py-8">
                У вас пока нет друзей
              </div>
            ) : (
              friends.map(friend => (
                <div key={friend.id} className="glass p-4 flex items-center gap-3 rounded-2xl">
                  <Avatar src={friend.friendData.photoURL} name={friend.friendData.displayName} size="md" />
                  <div className="flex-1">
                    <div className="font-medium">{friend.friendData.displayName}</div>
                    <div className="text-sm text-[#AAAAAA]">@{friend.friendData.username || 'пользователь'}</div>
                  </div>
                  <button
                    onClick={() => handleWriteMessage(friend.friendId)}
                    className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-sm hover:bg-blue-500/30 transition-all"
                  >
                    Написать
                  </button>
                  <button
                    onClick={() => removeFriend(friend.id)}
                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm hover:bg-red-500/30 transition-all"
                  >
                    Удалить
                  </button>
                </div>
              ))
            )
          ) : (
            requests.length === 0 ? (
              <div className="text-center text-[#AAAAAA] py-8">
                Нет входящих заявок
              </div>
            ) : (
              requests.map(request => (
                <div key={request.id} className="glass p-4 flex items-center gap-3 rounded-2xl">
                  <Avatar src={request.requesterData.photoURL} name={request.requesterData.displayName} size="md" />
                  <div className="flex-1">
                    <div className="font-medium">{request.requesterData.displayName}</div>
                    <div className="text-sm text-[#AAAAAA]">Хочет добавить в друзья</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(request.id)}
                      className="px-4 py-2 bg-green-500/20 text-green-400 rounded-xl text-sm hover:bg-green-500/30 transition-all"
                    >
                      Принять
                    </button>
                    <button
                      onClick={() => rejectRequest(request.id)}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm hover:bg-red-500/30 transition-all"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};