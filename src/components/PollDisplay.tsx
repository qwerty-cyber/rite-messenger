// PollDisplay.tsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, Timestamp, collection, query, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { BarChart2, Heart, MessageCircle, Bookmark, BookmarkCheck, MoreHorizontal, Copy, Flag, Trash2, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { CommentsModal } from './CommentsModal';
import { ReportModal } from './ReportModal';

interface PollDisplayProps {
  pollId: string;
}

export const PollDisplay: React.FC<PollDisplayProps> = ({ pollId }) => {
  const [poll, setPoll] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<string[]>([]);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [showReport, setShowReport] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const currentUser = auth.currentUser;
  const isAuthor = currentUser && poll?.createdBy === currentUser.uid;
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  useEffect(() => {
    if (!pollId) return;
    const unsubscribe = onSnapshot(doc(db, 'polls', pollId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPoll({ id: snapshot.id, ...data });
        setLikes(data.likes || []);
        setCommentsCount(data.commentsCount || 0);
        setLiked(currentUser ? (data.likes || []).includes(currentUser.uid) : false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [pollId, currentUser]);

  // Загрузка реакций
  useEffect(() => {
    if (!pollId) return;
    const loadReactions = async () => {
      const q = query(collection(db, 'reactions'), where('postId', '==', pollId));
      const snapshot = await getDocs(q);
      const reacts: Record<string, string[]> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!reacts[data.emoji]) reacts[data.emoji] = [];
        reacts[data.emoji].push(data.userId);
      });
      setReactions(reacts);
    };
    loadReactions();
  }, [pollId]);

  useEffect(() => {
    if (!currentUser || !pollId) return;
    const checkBookmark = async () => {
      const q = query(collection(db, 'bookmarks'), where('userId', '==', currentUser.uid), where('pollId', '==', pollId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) { setSaved(true); setBookmarkId(snapshot.docs[0].id); }
    };
    checkBookmark();
  }, [currentUser, pollId]);

  const handleVote = async (optionIndex: number) => {
    if (!currentUser || !poll) return;
    const pollRef = doc(db, 'polls', pollId);
    const updatedOptions = [...poll.options];
    const alreadyVoted = updatedOptions[optionIndex].votes?.includes(currentUser.uid);
    if (alreadyVoted) {
      updatedOptions[optionIndex].votes = updatedOptions[optionIndex].votes.filter((uid: string) => uid !== currentUser.uid);
    } else {
      updatedOptions.forEach((opt: any, i: number) => {
        if (i !== optionIndex) opt.votes = (opt.votes || []).filter((uid: string) => uid !== currentUser.uid);
      });
      updatedOptions[optionIndex].votes = [...(updatedOptions[optionIndex].votes || []), currentUser.uid];
    }
    const totalVotes = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.votes?.length || 0), 0);
    await updateDoc(pollRef, { options: updatedOptions, totalVotes, updatedAt: Timestamp.now() });
  };

  const handleLike = async () => {
    if (!currentUser || !pollId) return;
    const pollRef = doc(db, 'polls', pollId);
    try {
      if (liked) { await updateDoc(pollRef, { likes: arrayRemove(currentUser.uid) }); setLikes(prev => prev.filter(uid => uid !== currentUser.uid)); }
      else { await updateDoc(pollRef, { likes: arrayUnion(currentUser.uid) }); setLikes(prev => [...prev, currentUser.uid]); setShowLikeAnimation(true); setTimeout(() => setShowLikeAnimation(false), 500); }
      setLiked(!liked);
    } catch (error) { console.error('Ошибка лайка:', error); }
  };

  const toggleBookmark = async () => {
    if (!currentUser) return;
    if (saved && bookmarkId) { await deleteDoc(doc(db, 'bookmarks', bookmarkId)); setSaved(false); setBookmarkId(null); }
    else { const ref = await addDoc(collection(db, 'bookmarks'), { userId: currentUser.uid, pollId: pollId, createdAt: Timestamp.now() }); setSaved(true); setBookmarkId(ref.id); }
  };

  const handleReaction = async (emoji: string) => {
    if (!currentUser) return;
    try {
      const q = query(collection(db, 'reactions'), where('postId', '==', pollId), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc_ = snapshot.docs[0];
        if (doc_.data().emoji === emoji) { await deleteDoc(doc(db, 'reactions', doc_.id)); }
        else { await updateDoc(doc(db, 'reactions', doc_.id), { emoji }); }
      } else {
        await addDoc(collection(db, 'reactions'), { postId: pollId, userId: currentUser.uid, emoji, createdAt: Timestamp.now() });
      }
      setShowReactions(false);
      const q2 = query(collection(db, 'reactions'), where('postId', '==', pollId));
      const snapshot2 = await getDocs(q2);
      const reacts: Record<string, string[]> = {};
      snapshot2.docs.forEach(doc => { const data = doc.data(); if (!reacts[data.emoji]) reacts[data.emoji] = []; reacts[data.emoji].push(data.userId); });
      setReactions(reacts);
    } catch (error) { console.error('Ошибка реакции:', error); }
  };

  const handleMenuToggle = () => {
    if (!menuOpen && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen(!menuOpen);
  };

  const handleDeletePoll = async () => {
    if (!isAuthor || !currentUser) return;
    if (!window.confirm('Вы уверены, что хотите удалить этот опрос?')) return;
    try { await deleteDoc(doc(db, 'polls', pollId)); } catch (error) { console.error('Ошибка удаления опроса:', error); alert('Не удалось удалить опрос'); }
  };

  if (loading) return <div className="text-center py-4 text-[var(--text-secondary)]">Загрузка...</div>;
  if (!poll) return null;

  const maxVotes = Math.max(...(poll.options || []).map((opt: any) => opt.votes?.length || 0), 1);
  const userVoted = (poll.options || []).some((opt: any) => (opt.votes || []).includes(currentUser?.uid));

  return (
    <>
      <div className="glass-heavy p-4 rounded-2xl space-y-3">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${poll.createdBy || '#'}`} className="flex-shrink-0">
            <Avatar src={poll.authorPhotoURL || null} name={poll.authorName || 'Пользователь'} size="md" />
          </Link>
          <div className="flex-1">
            <Link to={`/profile/${poll.createdBy || '#'}`} className="hover:underline">
              <span className="font-semibold text-[var(--text-primary)]">{poll.authorName || 'Пользователь'}</span>
            </Link>
            <div className="text-xs text-[var(--text-secondary)]">{poll.createdAt?.toDate()?.toLocaleString() || 'Недавно'}</div>
          </div>
          <button ref={menuButtonRef} onClick={handleMenuToggle} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-white/10">
            <MoreHorizontal size={18} />
          </button>
        </div>

        <div className="flex items-start gap-2">
          <BarChart2 size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <span className="font-medium text-[var(--text-primary)]">{poll.question}</span>
          {userVoted && <span className="text-xs text-green-400 ml-auto flex-shrink-0">✓ Проголосовал</span>}
        </div>

        <div className="space-y-2">
          {(poll.options || []).map((option: any, index: number) => {
            const voteCount = option.votes?.length || 0;
            const percentage = poll.totalVotes > 0 ? Math.round((voteCount / poll.totalVotes) * 100) : 0;
            const widthPercent = poll.totalVotes > 0 ? Math.round((voteCount / maxVotes) * 100) : 0;
            const isSelected = option.votes?.includes(currentUser?.uid);
            return (
              <button key={index} onClick={() => handleVote(index)} className="w-full relative overflow-hidden rounded-xl bg-white/5 hover:bg-white/10 transition-colors p-3 text-left">
                <div className="absolute inset-0 bg-blue-500/20 transition-all duration-500 rounded-xl" style={{ width: `${widthPercent}%` }} />
                <div className="relative flex items-center justify-between">
                  <span className="text-[var(--text-primary)] text-sm font-medium">{option.text}{isSelected && <span className="ml-2 text-xs text-blue-400">✓</span>}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)] text-xs">{voteCount}</span>
                    <span className="text-[var(--text-secondary)] text-xs">({percentage}%)</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[var(--text-secondary)] pt-2 border-t border-[var(--border-color)]">
          <div className="relative">
            <button onClick={handleLike} className={`flex items-center gap-1.5 transition-colors ${liked ? 'text-red-500' : 'hover:text-[var(--text-primary)]'}`}>
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
              <span className="text-sm">{likes.length}</span>
            </button>
            <AnimatePresence>{showLikeAnimation && <motion.div initial={{ opacity: 1, y: 0, scale: 0.5 }} animate={{ opacity: 0, y: -30, scale: 1.5 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute left-1/2 -top-6 -translate-x-1/2 pointer-events-none"><span className="text-xl">❤️</span></motion.div>}</AnimatePresence>
          </div>

          <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors">
            <MessageCircle className="w-5 h-5" /><span className="text-sm">{commentsCount || 0}</span>
          </button>

          {/* Реакции */}
          <div className="relative flex items-center gap-1">
            {Object.keys(reactions).length > 0 && (
              <div className="flex gap-0.5">
                {Object.entries(reactions).map(([emoji, users]) => (
                  <button key={emoji} onClick={() => handleReaction(emoji)} className="bg-white/10 hover:bg-white/20 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5 transition-colors">
                    <span>{emoji}</span>
                    <span className="text-[var(--text-secondary)]">{users.length}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowReactions(!showReactions)} className="flex items-center hover:text-[var(--text-primary)] transition-colors">
              <span className="text-sm">😊</span>
            </button>
            {showReactions && (
              <div className="absolute bottom-full left-0 mb-2 bg-[var(--bg-secondary)] backdrop-blur-xl rounded-xl shadow-xl border border-[var(--border-color)] p-2 flex gap-1 z-50" onClick={(e) => e.stopPropagation()}>
                {quickEmojis.map(emoji => <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }} className="p-1.5 hover:bg-white/10 rounded-lg text-lg transition-colors">{emoji}</button>)}
              </div>
            )}
          </div>

          <button onClick={toggleBookmark} className={`flex items-center gap-1.5 transition-colors ${saved ? 'text-yellow-400' : 'hover:text-[var(--text-primary)]'}`}>
            {saved ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
          </button>

          <span className="text-xs text-[var(--text-secondary)] ml-auto">{poll.totalVotes || 0} голосов</span>
        </div>
      </div>

      {menuOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[99998]" onClick={() => setMenuOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed bg-[var(--bg-secondary)] backdrop-blur-xl rounded-xl shadow-xl border border-[var(--border-color)] overflow-hidden" style={{ zIndex: 99999, top: `${menuPosition.top}px`, right: `${menuPosition.right}px`, minWidth: '192px' }}>
            <button onClick={() => { navigator.clipboard?.writeText(`https://rite-messenger.vercel.app/poll/${poll.id}`); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-white/10"><Copy className="w-4 h-4" /> Скопировать ссылку</button>
            <button onClick={() => { setShowReport(true); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/10"><Flag className="w-4 h-4" /> Пожаловаться</button>
            {isAuthor && (
              <>
                <button onClick={() => { setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-white/10"><Pin size={16} /> Закрепить</button>
                <button onClick={() => { handleDeletePoll(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/10"><Trash2 size={16} /> Удалить</button>
              </>
            )}
          </motion.div>
        </>, document.body
      )}

      {showComments && <CommentsModal postId={pollId} onClose={() => setShowComments(false)} />}
      {showReport && <ReportModal postId={pollId} onClose={() => setShowReport(false)} />}
    </>
  );
};