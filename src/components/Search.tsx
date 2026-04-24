// Search.tsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Avatar } from './Avatar';
import { Search as SearchIcon, Users, FileText } from 'lucide-react';

type SearchTab = 'people' | 'posts';

export const Search: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('people');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Автозапуск поиска при переходе
  useEffect(() => {
    const queryFromUrl = searchParams.get('q');
    if (queryFromUrl) {
      setSearchQuery(queryFromUrl);
      // Определяем вкладку по первому символу
      if (queryFromUrl.startsWith('#')) {
        setActiveTab('posts');
      } else {
        setActiveTab('people');
      }
      handleSearchWithQuery(queryFromUrl);
    }
  }, [searchParams]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    handleSearchWithQuery(searchQuery);
  };

  const handleSearchWithQuery = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      // Убираем # если есть
      const cleanQuery = q.startsWith('#') ? q.slice(1) : q;

      if (activeTab === 'people' && !q.startsWith('#')) {
        // Поиск людей
        const q_ = query(
          collection(db, 'usernames'),
          where('username', '>=', cleanQuery.toLowerCase()),
          where('username', '<=', cleanQuery.toLowerCase() + '\uf8ff')
        );
        const snapshot = await getDocs(q_);
        const users = [];

        for (const doc of snapshot.docs) {
          const data = doc.data();
          const userDoc = await getDocs(
            query(collection(db, 'users'), where('__name__', '==', data.userId))
          );
          if (!userDoc.empty) {
            users.push({
              id: userDoc.docs[0].id,
              type: 'user',
              ...userDoc.docs[0].data(),
              username: data.username,
            });
          }
        }
        setResults(users);
      } else {
        // Поиск постов
        const postsQuery = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(30)
        );
        const snapshot = await getDocs(postsQuery);
        const posts = snapshot.docs
          .filter(doc => {
            const data = doc.data();
            const text = (data.text || '').toLowerCase();
            const authorName = (data.authorName || '').toLowerCase();
            return text.includes(cleanQuery.toLowerCase()) ||
                   authorName.includes(cleanQuery.toLowerCase());
          })
          .map(doc => ({
            id: doc.id,
            type: 'post',
            ...doc.data()
          }));
        setResults(posts);
      }
    } catch (error) {
      console.error('Ошибка поиска:', error);
    } finally {
      setLoading(false);
    }
  };

  // При смене вкладки перезапускаем поиск
  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearchWithQuery(searchQuery);
    }
  }, [activeTab]);

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
          <h1 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">Поиск</h1>

          {/* Поле поиска */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={activeTab === 'people' ? 'Поиск по @username...' : 'Поиск по тексту постов...'}
              className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-md rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 bg-blue-500/30 hover:bg-blue-500/40 backdrop-blur-md rounded-xl font-medium disabled:opacity-50 transition-all"
            >
              <SearchIcon size={20} />
            </button>
          </div>

          {/* Вкладки */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('people')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'people'
                  ? 'bg-blue-500/30 text-blue-400'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
              }`}
            >
              <Users size={18} />
              Люди
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'posts'
                  ? 'bg-blue-500/30 text-blue-400'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
              }`}
            >
              <FileText size={18} />
              Посты
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {loading && (
            <div className="text-center text-[var(--text-secondary)] py-4">
              Загрузка...
            </div>
          )}

          {!loading && results.map(item => (
            item.type === 'user' ? (
              <div key={item.id} className="glass p-4 flex items-center justify-between rounded-2xl">
                <Link to={`/profile/${item.id}`} className="flex items-center gap-3 flex-1">
                  <Avatar src={item.photoURL} name={item.displayName} size="md" />
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{item.displayName}</div>
                    <div className="text-sm text-[var(--text-secondary)]">@{item.username}</div>
                  </div>
                </Link>
                <button
                  onClick={() => handleWriteMessage(item.id)}
                  className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-sm hover:bg-blue-500/30 transition-all"
                >
                  Написать
                </button>
              </div>
            ) : (
              <div key={item.id} className="glass p-4 rounded-2xl">
                <div className="font-medium text-[var(--text-primary)]">
                  {item.authorName || 'Пользователь'}
                </div>
                <div className="text-sm text-[var(--text-primary)] mt-1 opacity-90">
                  {item.text?.substring(0, 300)}
                  {item.text?.length > 300 && '...'}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-2">
                  {item.createdAt?.toDate?.()?.toLocaleString() || 'Недавно'}
                </div>
              </div>
            )
          ))}

          {!loading && results.length === 0 && searchQuery && (
            <div className="text-center text-[var(--text-secondary)] py-8">
              Ничего не найдено
            </div>
          )}

          {!searchQuery && (
            <div className="text-center text-[var(--text-secondary)] py-8">
              Введите запрос для поиска
            </div>
          )}
        </div>
      </div>
    </div>
  );
};