// CreatePost.tsx
import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';

export const CreatePost: React.FC = () => {
  const [text, setText] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Ограничение до 10 файлов за раз
    const newFiles = files.slice(0, 10);
    setImageFiles(prev => [...prev, ...newFiles]);

    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      const newUrls = [...prev];
      URL.revokeObjectURL(newUrls[index]); // освобождаем память
      return newUrls.filter((_, i) => i !== index);
    });
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('http://localhost:3001/upload', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Ошибка загрузки');
    const data = await response.json();
    return data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const mediaUrls = await Promise.all(imageFiles.map(file => uploadImage(file)));
      const media = mediaUrls.map(url => ({ type: 'image' as const, url }));

      await addDoc(collection(db, 'posts'), {
        text,
        media,
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Пользователь',
        authorPhotoURL: auth.currentUser.photoURL || null,
        createdAt: new Date(),
        likes: [],
        commentsCount: 0,
      });

      queryClient.invalidateQueries({ queryKey: ['posts'] });

      // Очищаем форму
      setText('');
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setImageFiles([]);
      setPreviewUrls([]);
    } catch (error) {
      console.error('Ошибка публикации:', error);
      alert('Не удалось опубликовать пост');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 rounded-2xl p-4 mb-4">
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что у вас нового?"
          className="w-full p-3 bg-white/10 rounded-xl text-white placeholder-[#AAAAAA] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />

        {/* Компактное квадратное превью */}
        {previewUrls.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {previewUrls.map((url, index) => (
              <div key={index} className="relative rounded-lg overflow-hidden bg-white/5 aspect-square">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl text-white text-sm transition-colors">
            <Plus size={16} />
            <span>Фото</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {imageFiles.length > 0 && (
            <span className="text-xs text-[#AAAAAA]">
              {imageFiles.length} {imageFiles.length === 1 ? 'фото' : 'фото'}
            </span>
          )}

          <button
            type="submit"
            disabled={loading || (!text.trim() && imageFiles.length === 0)}
            className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-1.5 rounded-xl text-white text-sm font-medium transition-colors"
          >
            {loading ? '...' : 'Опубликовать'}
          </button>
        </div>
      </form>
    </div>
  );
};