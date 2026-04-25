// PollCreator.tsx
import React, { useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { X, Plus, BarChart2 } from 'lucide-react';

interface PollCreatorProps {
  onClose: () => void;
  onCreated: () => void;
}

export const PollCreator: React.FC<PollCreatorProps> = ({ onClose, onCreated }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const validOptions = options.filter(o => o.trim());
    if (!question.trim() || validOptions.length < 2) {
      alert('Введите вопрос и минимум 2 варианта ответа');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'polls'), {
        question: question.trim(),
        options: validOptions.map(text => ({
          text: text.trim(),
          votes: []
        })),
        createdBy: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Пользователь',
        authorPhotoURL: auth.currentUser.photoURL || null,
        createdAt: Timestamp.now(),
        totalVotes: 0,
        likes: [],
        commentsCount: 0,
      });

      setQuestion('');
      setOptions(['', '']);
      onCreated();
      onClose();
    } catch (error) {
      console.error('Ошибка создания опроса:', error);
      alert('Не удалось создать опрос');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Затемнение фона */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Модальное окно */}
      <div className="relative bg-[var(--bg-secondary)] rounded-2xl w-[95%] max-w-md max-h-[85vh] overflow-y-auto shadow-2xl z-10">
        <div className="p-6">
          {/* Шапка */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <BarChart2 size={20} className="text-accent" />
              Новый опрос
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-secondary)]"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Вопрос */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                Вопрос
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="О чём хотите спросить?"
                className="w-full px-4 py-3 bg-white/10 rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </div>

            {/* Варианты ответов */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">
                Варианты ответов
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Вариант ${index + 1}`}
                      className="flex-1 px-4 py-3 bg-white/10 rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="p-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Добавить вариант */}
            {options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-2 text-accent text-sm hover:underline transition-all"
              >
                <Plus size={16} />
                Добавить вариант
              </button>
            )}

            {/* Кнопки */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-[var(--text-primary)] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-accent hover:bg-blue-700 rounded-xl font-medium text-white disabled:opacity-50 transition-colors"
              >
                {loading ? 'Создание...' : 'Создать опрос'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};