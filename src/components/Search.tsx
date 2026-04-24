// Search.tsx
import React, { useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { Search as SearchIcon } from 'lucide-react';

export const Search: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'usernames'),
        where('username', '>=', searchQuery.toLowerCase()),
        where('username', '<=', searchQuery.toLowerCase() + '\uf8ff')
      );
      const snapshot = await getDocs(q);
      const users = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', data.userId)));
        if (!userDoc.empty) {
          users.push({
            id: userDoc.docs[0].id,
            ...userDoc.docs[0].data(),
            username: data.username,
          });
        }
      }
      setResults(users);
    } catch (error) {
      console.error('Ошибка поиска:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWriteMessage = async (userId: string) => {
    if (!auth.currentUser) return;
    try {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      const chatsSnapshot = await getDocs(chatsQuery);
      const existingChat = chatsSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.participants.includes(userId);
      });

      if (existingChat) {
        navigate(`/messages/${existingChat.id}`);
      } else {
        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [auth.currentUser.uid, userId],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        navigate(`/messages/${newChat.id}`);
      }
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      alert('Не удалось начать чат');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Поиск</h1>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Поиск по @username..."
              className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-md rounded-xl text-white placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 bg-blue-500/30 hover:bg-blue-500/40 backdrop-blur-md rounded-xl font-medium disabled:opacity-50 transition-all"
            >
              <SearchIcon size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {results.map(user => (
            <div key={user.id} className="glass p-4 flex items-center justify-between rounded-2xl">
              <Link to={`/profile/${user.id}`} className="flex items-center gap-3 flex-1">
                <Avatar src={user.photoURL} name={user.displayName} size="md" />
                <div>
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-sm text-[#AAAAAA]">@{user.username}</div>
                </div>
              </Link>
              <button
                onClick={() => handleWriteMessage(user.id)}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-sm hover:bg-blue-500/30 transition-all"
              >
                Написать
              </button>
            </div>
          ))}
          {results.length === 0 && searchQuery && !loading && (
            <div className="text-center text-[#AAAAAA] py-8">Ничего не найдено</div>
          )}
        </div>
      </div>
    </div>
  );
};