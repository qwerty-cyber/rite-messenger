// CreatePostBar.tsx
import React, { useState, useRef } from 'react';
import { Image, File, BarChart2, Mic, Send, X, Plus } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { PollCreator } from './PollCreator';

const IMGBB_API_KEY = 'твой_ключ_здесь';

export const CreatePostBar: React.FC = () => {
  const [text, setText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles = files.slice(0, 10);
    setMediaFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newFiles.map(file => URL.createObjectURL(file))]);
    setShowAttachmentMenu(false);
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => { const newUrls = [...prev]; URL.revokeObjectURL(newUrls[index]); return newUrls.filter((_, i) => i !== index); });
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData(); formData.append('image', file);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) return data.data.url;
    throw new Error('Ошибка загрузки');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (!text.trim() && mediaFiles.length === 0) return;
    setLoading(true);
    try {
      let media: { type: string; url: string }[] = [];
      if (mediaFiles.length > 0) {
        const mediaUrls = await Promise.all(mediaFiles.map(file => uploadFile(file)));
        media = mediaUrls.map(url => ({ type: 'image' as const, url }));
      }
      await addDoc(collection(db, 'posts'), {
        text: text.trim(), media, authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Пользователь',
        authorPhotoURL: auth.currentUser.photoURL || null, createdAt: new Date(),
        likes: [], commentsCount: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setText(''); previewUrls.forEach(url => URL.revokeObjectURL(url)); setMediaFiles([]); setPreviewUrls([]);
    } catch (error) { console.error('Ошибка публикации:', error); alert('Не удалось опубликовать пост'); }
    finally { setLoading(false); }
  };

  const handlePoll = () => { setShowAttachmentMenu(false); setShowPollCreator(true); };
  const handleAudio = () => { alert('Запись аудио будет доступна позже!'); setShowAttachmentMenu(false); };

  return (
    <>
      <div className="glass border-t border-[var(--border-color)] p-2 sm:p-3">
        <div className="max-w-2xl mx-auto">
          {previewUrls.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeMedia(index)} className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded-full text-white"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-1.5 sm:gap-2">
            <div className="relative flex-shrink-0">
              <button type="button" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-1.5 sm:p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors">
                <Plus size={20} />
              </button>
              {showAttachmentMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-44 sm:w-48 bg-[var(--bg-secondary)] backdrop-blur-xl rounded-xl shadow-xl border border-[var(--border-color)] overflow-hidden z-20">
                  <button type="button" onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*,video/*'); fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-[var(--text-primary)] hover:bg-white/10"><Image size={18} />Фото или видео</button>
                  <button type="button" onClick={() => { fileInputRef.current?.setAttribute('accept', '*/*'); fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-[var(--text-primary)] hover:bg-white/10"><File size={18} />Файл</button>
                  <button type="button" onClick={handlePoll} className="w-full flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-[var(--text-primary)] hover:bg-white/10"><BarChart2 size={18} />Опрос</button>
                  <button type="button" onClick={handleAudio} className="w-full flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-[var(--text-primary)] hover:bg-white/10"><Mic size={18} />Аудио</button>
                </div>
              )}
            </div>

            <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 max-h-24 sm:max-h-32 overflow-y-auto">
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Написать..." className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none outline-none text-xs sm:text-sm" rows={1} style={{ minHeight: '20px', maxHeight: '80px' }} onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = 'auto'; target.style.height = Math.min(target.scrollHeight, 80) + 'px'; }} />
            </div>

            <button type="submit" disabled={loading || (!text.trim() && mediaFiles.length === 0)} className="p-1.5 sm:p-2 rounded-full text-blue-500 hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0">
              <Send size={20} />
            </button>

            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
          </form>
        </div>
      </div>

      {showPollCreator && <PollCreator onClose={() => setShowPollCreator(false)} onCreated={() => queryClient.invalidateQueries({ queryKey: ['posts'] })} />}
    </>
  );
};