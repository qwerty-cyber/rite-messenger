// About.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const About: React.FC = () => {
  const [showHistory, setShowHistory] = useState(false);

  const changelog = [
    {
      version: 'alpha 1.0.0',
      date: '26 апреля 2026',
      changes: [
        'Цвет акцента в настройках',
        'Обои для каждого чата',
        'Превью ссылок в сообщениях',
        'Анимация появления сообщений',
        'Звук отправки и входящего сообщения',
        'Режим "Не беспокоить"',
        'Анимация переключения темы',
        'Кнопка "Наверх" в ленте',
        'Лайтбоксы для аватарок в профилях',
        'Переход на свой профиль при клике на себя',
        'Кнопка "Написать" в друзьях — только личные чаты',
      ],
    },
    {
      version: 'alpha 0.0.1',
      date: '25 апреля 2026',
      changes: [
        'Запуск мессенджера rite',
        'Лента постов с фото и опросами',
        'Личные и групповые чаты',
        'Голосовые сообщения и стикеры',
        'Реакции на посты и сообщения',
        'Тёмная и светлая темы',
        'Система друзей, закладок и блокировок',
        'Админ-панель и жалобы',
        'Поиск по пользователям и постам',
        'Страница "О приложении"',
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 glass-heavy border-b border-[var(--border-color)]">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">О приложении</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Что нового */}
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">Что нового</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{changelog[0].version}</span>
              <span className="text-xs text-[var(--text-secondary)]">{changelog[0].date}</span>
            </div>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1 list-disc list-inside">
              {changelog[0].changes.map((change, j) => (<li key={j}>{change}</li>))}
            </ul>
          </div>

          {/* История изменений */}
          <div className="glass p-6 rounded-2xl">
            <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between text-lg font-bold text-[var(--text-primary)]">
              <span>История изменений</span>
              {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {showHistory && (
              <div className="mt-4 space-y-6">
                {changelog.map((entry, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{entry.version}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{entry.date}</span>
                    </div>
                    <ul className="text-sm text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                      {entry.changes.map((change, j) => (<li key={j}>{change}</li>))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">rite</h2>
            <p className="text-sm text-[var(--text-secondary)]">Версия: alpha 1.0.0</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Сборка: {new Date().toISOString().slice(0, 10)}</p>
          </div>

          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Пользовательское соглашение</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Используя данное приложение, вы соглашаетесь с тем, что все данные, включая переписку, изображения и голосовые сообщения, хранятся на серверах Firebase и ImgBB. Администрация не несёт ответственности за сохранность данных. Запрещено распространение незаконного контента, спама и оскорблений.</p>
          </div>

          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Политика конфиденциальности</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Мы собираем минимальные данные: email, имя пользователя, аватар. Данные используются исключительно для функционирования мессенджера. Вы можете удалить свой аккаунт в любой момент через настройки профиля. Мы не передаём данные третьим лицам.</p>
          </div>

          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Контакты</h2>
            <p className="text-sm text-[var(--text-secondary)]">По вопросам и предложениям: <a href="mailto:flagmantoto@gmail.com" className="text-blue-400 hover:underline">flagmantoto@gmail.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
};