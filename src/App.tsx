// App.tsx
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, MessageCircle, User, LogOut, Shield, Menu, X, Users } from 'lucide-react';
import { Feed } from './components/Feed';
import { Auth } from './components/Auth';
import { Profile } from './components/Profile';
import { Search as SearchPage } from './components/Search';
import { MessagesLayout } from './components/MessagesLayout';
import { ChatRoom } from './components/ChatRoom';
import { PublicProfile } from './components/PublicProfile';
import { AdminPanel } from './components/AdminPanel';
import { Friends } from './components/Friends';
import { auth } from './lib/firebase';
import { db } from './lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Avatar } from './components/Avatar';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const queryClient = new QueryClient();

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Подсчёт входящих заявок в друзья
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'friends'),
      where('receiverId', '==', firebaseUser.uid),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingRequests(snapshot.size);
    });
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Auth />;
  }

  const navItems = [
    { icon: Home, label: 'Лента', path: '/' },
    { icon: Search, label: 'Поиск', path: '/search' },
    { icon: MessageCircle, label: 'Сообщения', path: '/messages' },
    { icon: Users, label: 'Друзья', path: '/friends' },
    { icon: User, label: 'Профиль', path: '/profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/messages') return location.pathname.startsWith('/messages');
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen text-white bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {/* Затемнение фона при открытом мобильном меню */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Боковая панель с glass-эффектом */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 
          bg-white/5 backdrop-blur-xl border-r border-white/10
          flex flex-col
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Заголовок сайдбара */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            rite
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Навигация */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-300 ${
                isActive(item.path)
                  ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-500'
                  : 'text-[#AAAAAA] hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="relative">
                <item.icon size={22} />
                {/* Индикатор заявок в друзья */}
                {item.path === '/friends' && pendingRequests > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                    {pendingRequests}
                  </div>
                )}
              </div>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}

          {/* Админка */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-300 ${
                location.pathname === '/admin'
                  ? 'bg-red-500/20 text-red-400 border-l-2 border-red-500'
                  : 'text-[#AAAAAA] hover:bg-white/5 hover:text-white'
              }`}
            >
              <Shield size={22} />
              <span className="font-medium">Админка</span>
            </button>
          )}
        </nav>

        {/* Профиль и выход */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all mb-2"
          >
            <Avatar src={firebaseUser?.photoURL} name={firebaseUser?.displayName} size="sm" />
            <div className="flex-1 text-left truncate">
              <div className="font-medium text-sm truncate">
                {firebaseUser?.displayName || 'Пользователь'}
              </div>
              <div className="text-xs text-[#AAAAAA] truncate">{firebaseUser?.email}</div>
            </div>
          </button>
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-2 text-[#AAAAAA] hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Мобильный хедер */}
        <div className="lg:hidden bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 py-2 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10"
          >
            <Menu size={24} />
          </button>
          <h1 className="font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            rite
          </h1>
        </div>

        {/* Контент страницы */}
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<PublicProfile />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/messages" element={<MessagesLayout />}>
              <Route path=":chatId" element={<ChatRoom />} />
            </Route>
            <Route path="/friends" element={<Friends />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;