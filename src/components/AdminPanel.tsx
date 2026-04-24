// AdminPanel.tsx
import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Trash2, ArrowLeft, Users, FileText, MessageCircle, Ban, Flag } from 'lucide-react';
import { Avatar } from './Avatar';

export const AdminPanel: React.FC = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, posts: 0, chats: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'posts' | 'users' | 'reports'>('stats');
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAdmin) { navigate('/'); return; }
    if (!user) return;
    loadAllData();
  }, [user, isAdmin, authLoading]);

  const loadAllData = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const postsSnap = await getDocs(collection(db, 'posts'));
      const chatsSnap = await getDocs(collection(db, 'chats'));
      const reportsSnap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc')));
      setStats({ users: usersSnap.size, posts: postsSnap.size, chats: chatsSnap.size });
      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setPosts(postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setReports(reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error('Ошибка загрузки данных:', error); }
    finally { setLoading(false); }
  };

  const deletePost = async (postId: string) => {
    if (!window.confirm('Удалить этот пост?')) return;
    await deleteDoc(doc(db, 'posts', postId));
    setPosts(prev => prev.filter(p => p.id !== postId));
    setStats(prev => ({ ...prev, posts: prev.posts - 1 }));
  };

  const toggleBan = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus, updatedAt: Timestamp.now() });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) { console.error('Ошибка бана:', error); alert('Не удалось забанить пользователя'); }
  };

  const resolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', updatedAt: Timestamp.now() });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    } catch (error) { console.error('Ошибка обработки жалобы:', error); }
  };

  if (authLoading || loading) return <div className="flex items-center justify-center h-full text-[var(--text-primary)]">Загрузка...</div>;

  const tabs = [
    { key: 'stats', label: 'Статистика', icon: MessageCircle },
    { key: 'posts', label: 'Посты', icon: FileText },
    { key: 'users', label: 'Пользователи', icon: Users },
    { key: 'reports', label: 'Жалобы', icon: Flag },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl border-b border-[var(--border-color)]">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded-lg hover:bg-white/10 flex-shrink-0">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] truncate">Админ-панель</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Адаптивные вкладки с горизонтальной прокруткой */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.key
                    ? 'bg-blue-500/30 text-blue-400'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'stats' && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="glass p-4 sm:p-6 text-center rounded-2xl">
                <Users size={32} className="mx-auto mb-2 text-blue-400" />
                <div className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{stats.users}</div>
                <div className="text-xs sm:text-sm text-[var(--text-secondary)]">Пользователей</div>
              </div>
              <div className="glass p-4 sm:p-6 text-center rounded-2xl">
                <FileText size={32} className="mx-auto mb-2 text-green-400" />
                <div className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{stats.posts}</div>
                <div className="text-xs sm:text-sm text-[var(--text-secondary)]">Постов</div>
              </div>
              <div className="glass p-4 sm:p-6 text-center rounded-2xl">
                <MessageCircle size={32} className="mx-auto mb-2 text-purple-400" />
                <div className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{stats.chats}</div>
                <div className="text-xs sm:text-sm text-[var(--text-secondary)]">Чатов</div>
              </div>
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="space-y-3">
              {posts.length === 0 ? <div className="text-center text-[var(--text-secondary)] py-8">Постов нет</div> : posts.map(post => (
                <div key={post.id} className="glass p-4 flex justify-between items-start rounded-2xl">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="font-medium text-[var(--text-primary)] truncate">{post.authorName || 'Пользователь'}</div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1 break-words">{post.text?.substring(0, 100)}{post.text?.length > 100 && '...'}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-2">{post.createdAt?.toDate?.()?.toLocaleString() || 'Недавно'}</div>
                  </div>
                  <button onClick={() => deletePost(post.id)} className="text-red-400 hover:text-red-300 p-2 flex-shrink-0"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              {users.length === 0 ? <div className="text-center text-[var(--text-secondary)] py-8">Пользователей нет</div> : users.map(u => (
                <div key={u.id} className="glass p-4 flex justify-between items-center rounded-2xl">
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    <Avatar src={u.photoURL} name={u.displayName} size="md" />
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--text-primary)] truncate flex items-center gap-2">
                        {u.displayName || 'Без имени'}
                        {u.status === 'banned' && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex-shrink-0">Забанен</span>}
                      </div>
                      <div className="text-sm text-[var(--text-secondary)] truncate">{u.email}</div>
                    </div>
                  </div>
                  <button onClick={() => toggleBan(u.id, u.status || 'active')} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex-shrink-0 ${u.status === 'banned' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}>
                    <Ban size={14} className="inline mr-1" />{u.status === 'banned' ? 'Разбанить' : 'Забанить'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? <div className="text-center text-[var(--text-secondary)] py-8">Жалоб нет</div> : reports.map(report => (
                <div key={report.id} className="glass p-4 rounded-2xl">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--text-primary)]">{report.reason}</div>
                      <div className="text-sm text-[var(--text-secondary)]">От: {report.reporterName}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">Пост: {report.postId?.substring(0, 20)}...</div>
                      <div className="text-xs text-[var(--text-secondary)]">{report.createdAt?.toDate?.()?.toLocaleString() || 'Недавно'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs ${report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {report.status === 'pending' ? 'Новая' : 'Рассмотрена'}
                      </span>
                      {report.status === 'pending' && (
                        <button onClick={() => resolveReport(report.id)} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30 transition-all">Рассмотреть</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};