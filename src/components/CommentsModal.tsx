// CommentsModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { Avatar } from './Avatar';
import { useQueryClient } from '@tanstack/react-query';

interface CommentsModalProps {
  postId: string;
  onClose: () => void;
}

interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  createdAt: Timestamp;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({ postId, onClose }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;
  const queryClient = useQueryClient();

  useEffect(() => {
    const q = query(
      collection(db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Comment));
      setComments(commentsData);
    });
    return () => unsubscribe();
  }, [postId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        text: newComment,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Пользователь',
        authorPhotoURL: currentUser.photoURL || null,
        createdAt: Timestamp.now(),
      });

      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });

      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setNewComment('');
    } catch (error) {
      console.error('Ошибка отправки комментария:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C1C1E] rounded-2xl w-full max-w-md h-[600px] flex flex-col shadow-xl">
        {/* Шапка */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-bold text-lg">Комментарии</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-[#AAAAAA] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Список комментариев */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center text-[#AAAAAA] py-8">
              Пока нет комментариев. Будьте первым!
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <Avatar
                  src={comment.authorPhotoURL}
                  name={comment.authorName}
                  size="sm"
                />
                <div className="flex-1 bg-white/5 rounded-2xl px-4 py-2">
                  <div className="font-medium text-white text-sm">
                    {comment.authorName}
                  </div>
                  <div className="text-white/90 text-sm mt-0.5 break-words">
                    {comment.text}
                  </div>
                  <div className="text-[10px] text-[#AAAAAA] mt-1">
                    {comment.createdAt?.toDate().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Поле ввода */}
        <form onSubmit={handleSend} className="p-4 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Написать комментарий..."
            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-white placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};