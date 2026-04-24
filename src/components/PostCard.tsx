// PostCard.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Share2, MoreHorizontal, Copy, Flag,
  X, ChevronLeft, ChevronRight, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Avatar } from "./Avatar";
import { CommentsModal } from "./CommentsModal";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Post } from "../types";

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const currentUser = auth.currentUser;
  const liked = currentUser ? post.likes?.includes(currentUser.uid) : false;
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const isAuthor = currentUser?.uid === post.channel.id;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formattedDate = format(new Date(post.publishedAt), "d MMM в HH:mm", {
    locale: ru,
  });

  const handleLike = async () => {
    if (!currentUser) return;
    const postRef = doc(db, "posts", post.id);
    try {
      if (liked) {
        await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
        setShowLikeAnimation(true);
        setTimeout(() => setShowLikeAnimation(false), 500);
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    } catch (error) {
      console.error("Ошибка лайка:", error);
    }
  };

  const handleDelete = async () => {
    if (!isAuthor || !currentUser) return;
    if (!window.confirm("Вы уверены, что хотите удалить этот пост?")) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    } catch (error) {
      console.error("Ошибка удаления:", error);
      alert("Не удалось удалить пост");
    }
  };

  const renderFormattedText = () => {
    const parts = post.text.split(/(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <a
            key={index}
            href={linkMatch[2]}
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  const ImageWithLightbox: React.FC<{ src: string; index: number; className: string }> = ({
    src, index, className
  }) => {
    return (
      <img
        src={src}
        alt=""
        className={`${className} cursor-pointer`}
        onClick={() => setLightboxIndex(index)}
        loading="lazy"
      />
    );
  };

  const renderMedia = () => {
    const { media } = post;
    if (!media || media.length === 0) return null;
    const count = media.length;

    if (count === 1) {
      return (
        <div className="mt-3 rounded-xl overflow-hidden">
          <ImageWithLightbox
            src={media[0].url}
            index={0}
            className="w-full h-auto max-h-[500px] object-contain"
          />
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
          {media.map((item, i) => (
            <div key={i} className="relative pb-[100%]">
              <ImageWithLightbox
                src={item.url}
                index={i}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
          <div className="relative pb-[150%] row-span-2">
            <ImageWithLightbox
              src={media[0].url}
              index={0}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="grid grid-rows-2 gap-1">
            {[1, 2].map(idx => (
              <div key={idx} className="relative pb-[100%]">
                <ImageWithLightbox
                  src={media[idx].url}
                  index={idx}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    const displayMedia = media.slice(0, 4);
    const remaining = count - 4;
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden relative">
        {displayMedia.map((item, i) => (
          <div key={i} className="relative pb-[100%]">
            <ImageWithLightbox
              src={item.url}
              index={i}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ))}
        {remaining > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-sm px-2 py-1 rounded-lg z-10">
            +{remaining}
          </div>
        )}
      </div>
    );
  };

  const media = post.media || [];
  const totalMedia = media.length;

  const nextImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % totalMedia);
    }
  };

  const prevImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + totalMedia) % totalMedia);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex]);

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="glass p-4 hover:bg-white/[0.12] transition-all duration-300 rounded-2xl"
      >
        {/* Шапка с кликабельным автором */}
        <div className="flex items-start gap-3">
          <Link to={`/profile/${post.channel.id}`} className="flex-shrink-0">
            <Avatar src={post.channel.avatar} name={post.channel.name} size="md" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link to={`/profile/${post.channel.id}`} className="hover:underline">
                <h3 className="font-semibold text-white">{post.channel.name}</h3>
              </Link>
              <span className="text-xs text-[#AAAAAA]">·</span>
              <time className="text-xs text-[#AAAAAA]">{formattedDate}</time>
            </div>
            <div className="mt-2 text-white/90 text-sm leading-relaxed">
              {renderFormattedText()}
            </div>
          </div>
          {/* Меню */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-[#AAAAAA] hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute right-0 mt-2 w-48 bg-white/10 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 overflow-hidden z-20"
                >
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(`https://app.example/post/${post.id}`);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10"
                  >
                    <Copy className="w-4 h-4" />
                    Скопировать ссылку
                  </button>
                  <button
                    onClick={() => {
                      alert("Жалоба отправлена (демо)");
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/10"
                  >
                    <Flag className="w-4 h-4" />
                    Пожаловаться
                  </button>
                  {isAuthor && (
                    <button
                      onClick={() => {
                        handleDelete();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/10"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {renderMedia()}

        <div className="flex items-center gap-6 mt-4 text-[#AAAAAA]">
          <div className="relative">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-colors ${
                liked ? "text-red-500" : "hover:text-white"
              }`}
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
              <span className="text-sm">{post.likes?.length || 0}</span>
            </button>
            <AnimatePresence>
              {showLikeAnimation && (
                <motion.div
                  initial={{ opacity: 1, y: 0, scale: 0.5 }}
                  animate={{ opacity: 0, y: -30, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute left-1/2 -top-6 -translate-x-1/2 pointer-events-none"
                >
                  <span className="text-xl">❤️</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setShowComments(true)}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{post.commentsCount || 0}</span>
          </button>

          <button className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Share2 className="w-5 h-5" />
            <span className="text-sm">Поделиться</span>
          </button>
        </div>

        {showComments && (
          <CommentsModal postId={post.id} onClose={() => setShowComments(false)} />
        )}
      </motion.article>

      {/* Лайтбокс */}
      <AnimatePresence>
        {lightboxIndex !== null && totalMedia > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20"
            >
              <X size={24} />
            </button>
            <div className="absolute top-4 left-4 text-white/80 text-sm bg-black/30 backdrop-blur-md px-3 py-1 rounded-full z-20">
              {lightboxIndex + 1} / {totalMedia}
            </div>
            <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
              <img
                src={media[lightboxIndex].url}
                alt=""
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
            {totalMedia > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20"
                >
                  <ChevronLeft size={32} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20"
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}
            {totalMedia > 1 && (
              <div
                className="flex justify-center gap-2 p-4 bg-gradient-to-t from-black/50 to-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                {media.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxIndex(idx)}
                    className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${
                      idx === lightboxIndex ? 'border-blue-500 scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};