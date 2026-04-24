// ReportModal.tsx
import React, { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

interface ReportModalProps {
  postId: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  'Спам',
  'Оскорбление',
  'Контент для взрослых',
  'Насилие',
  'Мошенничество',
  'Другое'
];

export const ReportModal: React.FC<ReportModalProps> = ({ postId, onClose }) => {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    if (!reason) return;

    if (reason === 'Другое' && !customReason.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'reports'), {
        postId,
        reason: reason === 'Другое' ? customReason.trim() : reason,
        reportedBy: auth.currentUser.uid,
        reporterName: auth.currentUser.displayName || 'Пользователь',
        createdAt: Timestamp.now(),
        status: 'pending',
        postAuthorId: null // Можно добавить из post
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Ошибка отправки жалобы:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--bg-secondary)] rounded-2xl w-[95%] max-w-md shadow-2xl z-10">
        <div className="p-6">
          {/* Шапка */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Flag size={20} className="text-red-400" />
              {submitted ? 'Жалоба отправлена' : 'Пожаловаться'}
            </h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-secondary)]">
              <X size={20} />
            </button>
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <div className="text-green-400 text-4xl mb-3">✓</div>
              <p className="text-[var(--text-primary)]">Спасибо! Мы рассмотрим вашу жалобу.</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[var(--text-primary)] transition-colors"
              >
                Закрыть
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Выберите причину жалобы:
              </p>

              <div className="space-y-2 mb-4">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                      reason === r
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-white/5 text-[var(--text-primary)] hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {reason === 'Другое' && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Опишите причину..."
                  className="w-full px-4 py-3 bg-white/10 rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:outline-none mb-4"
                  rows={3}
                />
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !reason}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium text-white disabled:opacity-50 transition-colors"
              >
                {loading ? 'Отправка...' : 'Отправить жалобу'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};