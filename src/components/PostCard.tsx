// PostCard.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Share2, MoreHorizontal, Copy, Flag,
  X, ChevronLeft, ChevronRight, Trash2, Pin, PinOff, Bookmark, BookmarkCheck
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, Timestamp, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Avatar } from "./Avatar";
import { CommentsModal } from "./CommentsModal";
import { ReportModal } from "./ReportModal";
import { Link } from "react-router-dom";
import type { Post } from "../types";

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const currentUser = auth.currentUser;
  const [liked, setLiked] = useState(currentUser ? post.likes?.includes(currentUser.uid) : false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const isAuthor = currentUser?.uid === post.channel.id;
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  useEffect(() => {
    const checkBookmark = async () => {
      if (!currentUser) return;
      const q = query(collection(db, 'bookmarks'), where('userId', '==', currentUser.uid), where('postId', '==', post.id));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) { setSaved(true); setBookmarkId(snapshot.docs[0].id); }
    };
    checkBookmark();
    const loadReactions = async () => {
      const q = query(collection(db, 'reactions'), where('postId', '==', post.id));
      const snapshot = await getDocs(q);
      const reacts: Record<string, string[]> = {};
      snapshot.docs.forEach(doc => { const data = doc.data(); if (!reacts[data.emoji]) reacts[data.emoji] = []; reacts[data.emoji].push(data.userId); });
      setReactions(reacts);
    };
    loadReactions();
  }, [currentUser, post.id]);

  const formattedDate = format(new Date(post.publishedAt), "d MMM в HH:mm", { locale: ru });

  const handleLike = async () => {
    if (!currentUser) return;
    const postRef = doc(db, "posts", post.id);
    try {
      if (liked) { await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) }); post.likes = post.likes.filter((uid: string) => uid !== currentUser.uid); }
      else { await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) }); setShowLikeAnimation(true); setTimeout(() => setShowLikeAnimation(false), 500); post.likes = [...post.likes, currentUser.uid]; }
      setLiked(!liked);
    } catch (error) { console.error("Ошибка лайка:", error); }
  };

  const handleDelete = async () => {
    if (!isAuthor || !currentUser) return;
    if (!window.confirm("Вы уверены, что хотите удалить этот пост?")) return;
    try { await deleteDoc(doc(db, "posts", post.id)); } catch (error) { console.error("Ошибка удаления:", error); }
  };

  const handlePin = async () => {
    if (!isAuthor || !currentUser) return;
    const isPinned = (post as any).pinned || false;
    try { await updateDoc(doc(db, "posts", post.id), { pinned: !isPinned }); (post as any).pinned = !isPinned; } catch (error) { console.error("Ошибка закрепления:", error); }
  };

  const toggleBookmark = async () => {
    if (!currentUser) return;
    if (saved && bookmarkId) { await deleteDoc(doc(db, 'bookmarks', bookmarkId)); setSaved(false); setBookmarkId(null); }
    else { const ref = await addDoc(collection(db, 'bookmarks'), { userId: currentUser.uid, postId: post.id, post: post, createdAt: Timestamp.now() }); setSaved(true); setBookmarkId(ref.id); }
  };

  const handleReaction = async (emoji: string) => {
    if (!currentUser) return;
    const userReactionQuery = query(collection(db, 'reactions'), where('postId', '==', post.id), where('userId', '==', currentUser.uid));
    const userSnapshot = await getDocs(userReactionQuery);
    if (!userSnapshot.empty) {
      const existingDoc = userSnapshot.docs[0];
      if (existingDoc.data().emoji === emoji) { await deleteDoc(doc(db, 'reactions', existingDoc.id)); }
      else { await updateDoc(doc(db, 'reactions', existingDoc.id), { emoji }); }
    } else { await addDoc(collection(db, 'reactions'), { postId: post.id, userId: currentUser.uid, emoji, createdAt: Timestamp.now() }); }
    setShowReactions(false);
    const q2 = query(collection(db, 'reactions'), where('postId', '==', post.id));
    const snapshot2 = await getDocs(q2);
    const reacts: Record<string, string[]> = {};
    snapshot2.docs.forEach(doc => { const data = doc.data(); if (!reacts[data.emoji]) reacts[data.emoji] = []; reacts[data.emoji].push(data.userId); });
    setReactions(reacts);
  };

  const handleMenuToggle = () => {
    if (!menuOpen && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen(!menuOpen);
  };

  const renderFormattedText = () => {
    const parts = post.text.split(/(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) return <a key={index} href={linkMatch[2]} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">{linkMatch[1]}</a>;
      const processedText = part.split(/(#\w+|@\w+)/g).map((subPart, subIndex) => {
        if (subPart.startsWith('#')) return <span key={`${index}-${subIndex}`} className="text-accent hover:underline cursor-pointer" onClick={() => window.location.href = `/search?q=${encodeURIComponent(subPart)}`}>{subPart}</span>;
        if (subPart.startsWith('@')) return <span key={`${index}-${subIndex}`} className="text-accent hover:underline cursor-pointer" onClick={() => window.location.href = `/search?q=${encodeURIComponent(subPart)}`}>{subPart}</span>;
        return subPart;
      });
      return <span key={index}>{processedText}</span>;
    });
  };

  const ImageWithLightbox: React.FC<{ src: string; index: number; className: string }> = ({ src, index, className }) => (
    <img src={src} alt="" className={`${className} cursor-pointer`} onClick={() => setLightboxIndex(index)} loading="lazy" />
  );

  const renderMedia = () => {
    const { media } = post;
    if (!media || media.length === 0) return null;
    const count = media.length;
    if (count === 1) return <div className="mt-3 rounded-xl overflow-hidden"><ImageWithLightbox src={media[0].url} index={0} className="w-full h-auto max-h-[500px] object-contain" /></div>;
    if (count === 2) return <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>{media.map((item, i) => <div key={i} className="relative pb-[100%]"><ImageWithLightbox src={item.url} index={i} className="absolute inset-0 w-full h-full object-cover" /></div>)}</div>;
    if (count === 3) return <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)' }}><div className="relative pb-[150%] row-span-2"><ImageWithLightbox src={media[0].url} index={0} className="absolute inset-0 w-full h-full object-cover" /></div><div className="grid grid-rows-2 gap-1">{[1, 2].map(idx => <div key={idx} className="relative pb-[100%]"><ImageWithLightbox src={media[idx].url} index={idx} className="absolute inset-0 w-full h-full object-cover" /></div>)}</div></div>;
    const displayMedia = media.slice(0, 4);
    const remaining = count - 4;
    return <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden relative" style={{ background: 'var(--bg-secondary)' }}>{displayMedia.map((item, i) => <div key={i} className="relative pb-[100%]"><ImageWithLightbox src={item.url} index={i} className="absolute inset-0 w-full h-full object-cover" /></div>)}{remaining > 0 && <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-sm px-2 py-1 rounded-lg z-10">+{remaining}</div>}</div>;
  };

  const media = post.media || [];
  const totalMedia = media.length;
  const nextImage = () => { if (lightboxIndex !== null) setLightboxIndex((lightboxIndex + 1) % totalMedia); };
  const prevImage = () => { if (lightboxIndex !== null) setLightboxIndex((lightboxIndex - 1 + totalMedia) % totalMedia); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (lightboxIndex === null) return; if (e.key === "ArrowLeft") prevImage(); if (e.key === "ArrowRight") nextImage(); if (e.key === "Escape") setLightboxIndex(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex]);

  return (
    <>
      <motion.article initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="glass-heavy p-4 hover:bg-[var(--bg-card-hover)] transition-all duration-300 rounded-2xl">
        {(post as any).pinned && <div className="text-xs text-yellow-400 mb-2 flex items-center gap-1"><Pin size={12} /> Закреплено</div>}

        <div className="flex items-start gap-3">
         <Link to={post.channel.id === currentUser?.uid ? '/profile' : `/profile/${post.channel.id}`} className="flex-shrink-0"><Avatar src={post.channel.avatar} name={post.channel.name} size="md" /></Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link to={post.channel.id === currentUser?.uid ? '/profile' : `/profile/${post.channel.id}`} className="hover:underline"><h3 className="font-semibold text-[var(--text-primary)]">{post.channel.name}</h3></Link>
              <span className="text-xs text-[var(--text-secondary)]">·</span>
              <time className="text-xs text-[var(--text-secondary)]">{formattedDate}</time>
            </div>
            <div className="mt-2 text-[var(--text-primary)] opacity-90 text-sm leading-relaxed">{renderFormattedText()}</div>
          </div>
          <button ref={menuButtonRef} onClick={handleMenuToggle} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-white/10"><MoreHorizontal className="w-5 h-5" /></button>
        </div>

        {renderMedia()}

        <div className="flex items-center gap-2 mt-4 text-[var(--text-secondary)]">
          <div className="relative">
            <button onClick={handleLike} className={`flex items-center gap-1.5 transition-colors ${liked ? "text-red-500" : "hover:text-[var(--text-primary)]"}`}><Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} /><span className="text-sm">{post.likes?.length || 0}</span></button>
            <AnimatePresence>{showLikeAnimation && <motion.div initial={{ opacity: 1, y: 0, scale: 0.5 }} animate={{ opacity: 0, y: -30, scale: 1.5 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute left-1/2 -top-6 -translate-x-1/2 pointer-events-none"><span className="text-xl">❤️</span></motion.div>}</AnimatePresence>
          </div>
          <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors"><MessageCircle className="w-5 h-5" /><span className="text-sm">{post.commentsCount || 0}</span></button>

          <div className="relative flex items-center gap-1">
            {Object.keys(reactions).length > 0 && (
              <div className="flex gap-0.5">
                {Object.entries(reactions).slice(0, 3).map(([emoji, users]) => (
                  <button key={emoji} onClick={() => handleReaction(emoji)} className="bg-white/10 hover:bg-white/20 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5 transition-colors">
                    <span>{emoji}</span>
                    {users.length > 1 && <span className="text-[var(--text-secondary)]">{users.length}</span>}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowReactions(!showReactions)} className="flex items-center hover:text-[var(--text-primary)] transition-colors"><span className="text-sm">😊</span></button>
            {showReactions && (
              <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a3e] rounded-xl shadow-xl border border-[var(--border-color)] p-2 flex gap-1 z-50" onClick={(e) => e.stopPropagation()}>
                {quickEmojis.map(emoji => <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }} className="p-1.5 hover:bg-white/10 rounded-lg text-lg transition-colors">{emoji}</button>)}
              </div>
            )}
          </div>

          <button className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors"><Share2 className="w-5 h-5" /><span className="text-sm">Поделиться</span></button>
          <button onClick={toggleBookmark} className={`flex items-center gap-1.5 transition-colors ${saved ? 'text-yellow-400' : 'hover:text-[var(--text-primary)]'}`}>{saved ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}</button>
        </div>

        {showComments && <CommentsModal postId={post.id} onClose={() => setShowComments(false)} />}
        {showReport && <ReportModal postId={post.id} onClose={() => setShowReport(false)} />}
      </motion.article>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[99998]" onClick={() => setMenuOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed bg-[#1a1a3e] rounded-xl shadow-xl border border-[var(--border-color)] overflow-hidden py-1" style={{ zIndex: 99999, top: `${menuPosition.top}px`, right: `${menuPosition.right}px`, minWidth: '192px' }}>
            <button onClick={() => { navigator.clipboard?.writeText(`https://app.example/post/${post.id}`); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-white/5"><Copy className="w-4 h-4" /> Скопировать ссылку</button>
            <button onClick={() => { setShowReport(true); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/5"><Flag className="w-4 h-4" /> Пожаловаться</button>
            {isAuthor && (
              <>
                <button onClick={() => { handlePin(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-white/5">{(post as any).pinned ? <><PinOff size={16} /> Открепить</> : <><Pin size={16} /> Закрепить</>}</button>
                <button onClick={() => { handleDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/5"><Trash2 className="w-4 h-4" /> Удалить</button>
              </>
            )}
          </motion.div>
        </>
      )}

      <AnimatePresence>
        {lightboxIndex !== null && totalMedia > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col" onClick={() => setLightboxIndex(null)}>
            <button onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20 text-white"><X size={24} /></button>
            <div className="absolute top-4 left-4 text-white/80 text-sm bg-black/30 backdrop-blur-md px-3 py-1 rounded-full z-20">{lightboxIndex + 1} / {totalMedia}</div>
            <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}><img src={media[lightboxIndex].url} alt="" className="max-w-full max-h-full object-contain rounded-lg" /></div>
            {totalMedia > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20 text-white"><ChevronLeft size={32} /></button>
                <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20 text-white"><ChevronRight size={32} /></button>
              </>
            )}
            {totalMedia > 1 && (
              <div className="flex justify-center gap-2 p-4 bg-gradient-to-t from-black/50 to-transparent" onClick={(e) => e.stopPropagation()}>
                {media.map((item, idx) => <button key={idx} onClick={() => setLightboxIndex(idx)} className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${idx === lightboxIndex ? 'border-accent scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}><img src={item.url} alt="" className="w-full h-full object-cover" /></button>)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};