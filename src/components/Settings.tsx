// Settings.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Eye, EyeOff, LogOut, Shield, Palette } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useToast } from './Toast';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [theme, setTheme] = useState(localStorage.getItem('theme') === 'light' ? 'light' : 'dark');
  const [hideNsfw, setHideNsfw] = useState(localStorage.getItem('hideNsfw') === 'true');
  const [accent, setAccent] = useState(localStorage.getItem('accentColor') || '#4f8fff');

  const colors = ['#4f8fff', '#f44f4f', '#4ff48f', '#f4b84f', '#b84ff4', '#f44fb8', '#00bcd4', '#ff9800'];

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.add('theme-transitioning');
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
    showToast(`Тема изменена на ${newTheme === 'light' ? 'светлую' : 'тёмную'}`, 'success');
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 500);
  };

  const toggleNsfw = () => {
    const newVal = !hideNsfw;
    setHideNsfw(newVal);
    localStorage.setItem('hideNsfw', String(newVal));
    showToast(newVal ? 'NSFW-контент скрыт' : 'NSFW-контент виден', 'info');
    setTimeout(() => window.location.reload(), 1000);
  };

  const setAccentColor = (color: string) => {
    setAccent(color);
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-hover', color + 'cc');
    localStorage.setItem('accentColor', color);
    showToast('Цвет акцента изменён', 'success');
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 glass-heavy border-b border-[var(--border-color)]">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Настройки</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <button onClick={toggleTheme} className="w-full glass p-4 rounded-2xl flex items-center gap-4 hover:bg-[var(--bg-card-hover)] transition-all">
            {theme === 'dark' ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} className="text-blue-400" />}
            <div className="flex-1 text-left"><div className="font-medium text-[var(--text-primary)]">Тема</div><div className="text-sm text-[var(--text-secondary)]">{theme === 'dark' ? 'Тёмная' : 'Светлая'}</div></div>
          </button>
          <button onClick={toggleNsfw} className="w-full glass p-4 rounded-2xl flex items-center gap-4 hover:bg-[var(--bg-card-hover)] transition-all">
            {hideNsfw ? <EyeOff size={24} className="text-red-400" /> : <Eye size={24} className="text-green-400" />}
            <div className="flex-1 text-left"><div className="font-medium text-[var(--text-primary)]">Контент 18+</div><div className="text-sm text-[var(--text-secondary)]">{hideNsfw ? 'Скрыт' : 'Виден'}</div></div>
          </button>
          <div className="glass p-4 rounded-2xl">
            <div className="flex items-center gap-3 mb-3"><Palette size={20} className="text-[var(--accent)]" /><span className="font-medium text-[var(--text-primary)]">Цвет акцента</span></div>
            <div className="flex gap-3 flex-wrap">{colors.map(color => (<button key={color} onClick={() => setAccentColor(color)} className="w-10 h-10 rounded-full transition-all hover:scale-110" style={{ backgroundColor: color, boxShadow: accent === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : 'none' }} />))}</div>
          </div>
          <div className="glass p-4 rounded-2xl flex items-center gap-4"><Shield size={24} className="text-[var(--accent)]" /><div className="flex-1 text-left"><div className="font-medium text-[var(--text-primary)]">Версия</div><div className="text-sm text-[var(--text-secondary)]">alpha 1.0.0</div></div></div>
          <button onClick={handleLogout} className="w-full glass p-4 rounded-2xl flex items-center gap-4 hover:bg-red-500/10 transition-all"><LogOut size={24} className="text-red-400" /><div className="flex-1 text-left"><div className="font-medium text-red-400">Выйти из аккаунта</div></div></button>
        </div>
      </div>
    </div>
  );
};