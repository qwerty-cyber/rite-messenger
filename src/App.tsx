// App.tsx
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, MessageCircle, User, LogOut, Shield, Menu, X, Users, Bookmark, Sun, Moon, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Feed } from './components/Feed';
import { Auth } from './components/Auth';
import { Profile } from './components/Profile';
import { Search as SearchPage } from './components/Search';
import { MessagesLayout } from './components/MessagesLayout';
import { ChatRoom } from './components/ChatRoom';
import { PublicProfile } from './components/PublicProfile';
import { AdminPanel } from './components/AdminPanel';
import { Friends } from './components/Friends';
import { Bookmarks } from './components/Bookmarks';
import { About } from './components/About';
import { auth } from './lib/firebase';
import { db } from './lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
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
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [hideNsfw, setHideNsfw] = useState(localStorage.getItem('hideNsfw') === 'true');

  useEffect(() => {
    if (theme === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const toggleNsfw = () => {
    const newVal = !hideNsfw;
    setHideNsfw(newVal);
    localStorage.setItem('hideNsfw', String(newVal));
    window.location.reload();
  };

  useEffect(() => { if (Notification.permission !== 'granted' && Notification.permission !== 'denied') Notification.requestPermission(); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setFirebaseUser(currentUser); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const checkBirthday = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const birthday = userDoc.data().birthday;
          if (birthday) {
            const today = new Date().toISOString().slice(5, 10);
            const userBD = birthday.slice(5, 10);
            if (today === userBD) setTimeout(() => alert('🎂 С днём рождения! Желаем всего наилучшего! 🎉'), 1500);
          }
        }
      } catch (error) {}
    };
    checkBirthday();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'friends'), where('receiverId', '==', firebaseUser.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => setPendingRequests(snapshot.size));
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); navigate('/'); setTimeout(() => { const t = document.querySelector('textarea'); t?.focus(); }, 100); }
      if (e.ctrlKey && e.key === 'm') { e.preventDefault(); navigate('/messages'); }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); navigate('/profile'); }
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-[var(--gradient-1)] via-[var(--gradient-2)] to-[var(--gradient-3)] flex items-center justify-center"><div className="text-[var(--text-primary)] text-xl">Загрузка...</div></div>;
  if (!firebaseUser) return <Auth />;

  const navItems = [
    { icon: Home, label: 'Лента', path: '/' },
    { icon: Search, label: 'Поиск', path: '/search' },
    { icon: MessageCircle, label: 'Сообщения', path: '/messages' },
    { icon: Users, label: 'Друзья', path: '/friends' },
    { icon: Bookmark, label: 'Закладки', path: '/bookmarks' },
    { icon: User, label: 'Профиль', path: '/profile' },
    { icon: Info, label: 'О приложении', path: '/about' },
  ];

  const isActive = (path: string) => path === '/messages' ? location.pathname.startsWith('/messages') : location.pathname === path;

  return (
    <div className="flex h-screen text-[var(--text-primary)]">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[var(--bg-secondary)] backdrop-blur-xl flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} border-r border-[var(--glass-border)]`}>
        <div className="p-4 border-b border-[var(--glass-border)] flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">rite</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-lg hover:bg-white/10"><X size={20} /></button>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-300 ${isActive(item.path) ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-500' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'}`}>
              <div className="relative">
                <item.icon size={22} />
                {item.path === '/friends' && pendingRequests > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold">{pendingRequests}</div>}
              </div>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
          {isAdmin && (
            <button onClick={() => navigate('/admin')} className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-300 ${location.pathname === '/admin' ? 'bg-red-500/20 text-red-400 border-l-2 border-red-500' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'}`}>
              <Shield size={22} /><span className="font-medium">Админка</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-[var(--glass-border)]">
          <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all mb-2">
            <Avatar src={firebaseUser?.photoURL} name={firebaseUser?.displayName} size="sm" />
            <div className="flex-1 text-left truncate"><div className="font-medium text-sm truncate">{firebaseUser?.displayName || 'Пользователь'}</div><div className="text-xs text-[var(--text-secondary)] truncate">{firebaseUser?.email}</div></div>
          </button>
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-2 text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-xl transition-all mb-2">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}<span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span></button>
          <button onClick={toggleNsfw} className="w-full flex items-center gap-3 px-4 py-2 text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-xl transition-all mb-2">{hideNsfw ? '🔞 NSFW скрыт' : '🔞 NSFW виден'}</button>
          <div className="px-4 py-2 text-center">
            <p className="text-xs text-[var(--text-secondary)]">rite alpha 0.0.1</p>
          </div>
          <button onClick={() => auth.signOut()} className="w-full flex items-center gap-3 px-4 py-2 text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-xl transition-all"><LogOut size={20} /><span>Выйти</span></button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <div className="lg:hidden glass-heavy border-b border-[var(--glass-border)] px-4 py-2 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-white/10"><Menu size={24} /></button>
          <h1 className="font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">rite</h1>
        </div>

        <AnimatePresence mode="wait">
          {location.pathname.startsWith('/messages') ? (
            <div key="messages" className="flex-1 overflow-hidden">
              <Routes location={location}>
                <Route path="/" element={<Feed />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<PublicProfile />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/messages" element={<MessagesLayout />}><Route path=":chatId" element={<ChatRoom />} /></Route>
                <Route path="/friends" element={<Friends />} />
                <Route path="/bookmarks" element={<Bookmarks />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          ) : (
            <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 overflow-hidden">
              <Routes location={location}>
                <Route path="/" element={<Feed />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<PublicProfile />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/messages" element={<MessagesLayout />}><Route path=":chatId" element={<ChatRoom />} /></Route>
                <Route path="/friends" element={<Friends />} />
                <Route path="/bookmarks" element={<Bookmarks />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function App() { return (<QueryClientProvider client={queryClient}><AuthProvider><AppContent /></AuthProvider></QueryClientProvider>); }
export default App;