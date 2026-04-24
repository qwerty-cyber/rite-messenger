// AdminPanel.tsx
import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Trash2, ArrowLeft, Users, FileText, MessageCircle, Ban } from 'lucide-react';
import { Avatar } from './Avatar';

export const AdminPanel: React.FC = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, posts: 0, chats: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'posts' | 'users'>('stats');
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
      return;
    }
    if (!user) return;
    loadAllData();
  }, [user, isAdmin, authLoading]);

  const loadAllData = async () => {
    const usersSnap = await getDocs(collection(db, 'users'));
    const postsSnap = await getDocs(collection(db, 'posts'));
    const chatsSnap = await getDocs(collection(db, 'chats'));

    setStats({
      users: usersSnap.size,
      posts: postsSnap.size,
      chats: chatsSnap.size
    });

    setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setPosts(postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  const deletePost = async (postId: string) => {
    if (!window.confirm('Удалить этот пост?')) return;
    await deleteDoc(doc(db, 'posts', postId));
    setPosts(prev => prev.filter(p => p.id !== postId));
    setStats(prev => ({ ...prev, posts: prev.posts - 1 }));
  };

  const toggleBan = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
    await updateDoc(doc(db, 'users', userId), { status: newStatus });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-[#AAAAAA] hover:text-white p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold">Админ-панель</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Вкладки */}
          <div className="flex gap-4 mb-6">
            {[
              { key: 'stats', label: 'Статистика', icon: MessageCircle },
              { key: 'posts', label: 'Посты', icon: FileText },
              { key: 'users', label: 'Пользователи', icon: Users },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-blue-500/30 text-blue-400'
                    : 'text-[#AAAAAA] hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={18} className="inline mr-2" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Контент вкладок */}
          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass p-6 text-center rounded-2xl">
                <Users size={40} className="mx-auto mb-3 text-blue-400" />
                <div className="text-3xl font-bold">{stats.users}</div>
                <div className="text-[#AAAAAA]">Пользователей</div>
              </div>
              <div className="glass p-6 text-center rounded-2xl">
                <FileText size={40} className="mx-auto mb-3 text-green-400" />
                <div className="text-3xl font-bold">{stats.posts}</div>
                <div className="text-[#AAAAAA]">Постов</div>
              </div>
              <div className="glass p-6 text-center rounded-2xl">
                <MessageCircle size={40} className="mx-auto mb-3 text-purple-400" />
                <div className="text-3xl font-bold">{stats.chats}</div>
                <div className="text-[#AAAAAA]">Чатов</div>
              </div>
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="text-center text-[#AAAAAA] py-8">Постов нет</div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="glass p-4 flex justify-between items-start rounded-2xl">
                    <div>
                      <div className="font-medium">{post.authorName || 'Пользователь'}</div>
                      <div className="text-sm text-[#AAAAAA] mt-1">{post.text}</div>
                      <div className="text-xs text-[#666] mt-2">
                        {post.createdAt?.toDate().toLocaleString()}
                      </div>
                    </div>
                    <button onClick={() => deletePost(post.id)} className="text-red-400 hover:text-red-300 p-2">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              {users.length === 0 ? (
                <div className="text-center text-[#AAAAAA] py-8">Пользователей нет</div>
              ) : (
                users.map(u => (
                  <div key={u.id} className="glass p-4 flex justify-between items-center rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.photoURL} name={u.displayName} size="md" />
                      <div>
                        <div className="font-medium">{u.displayName || 'Без имени'}</div>
                        <div className="text-sm text-[#AAAAAA]">{u.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleBan(u.id, u.status)}
                      className={`px-4 py-2 rounded-xl text-sm transition-all ${
                        u.status === 'banned'
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                    >
                      <Ban size={16} className="inline mr-1" />
                      {u.status === 'banned' ? 'Разбанить' : 'Забанить'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};