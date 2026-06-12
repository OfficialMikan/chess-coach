import { create } from 'zustand';

export const useStore = create((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // App state
  activeTab: 'play',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // AI — Gemini key (free forever at aistudio.google.com/apikey)
  geminiKey: localStorage.getItem('cc_gemini_key') || '',
  setGeminiKey: (key) => {
    localStorage.setItem('cc_gemini_key', key);
    set({ geminiKey: key });
  },

  // Trainer settings
  trainerSettings: {
    stockfishLevel: 5,
    stockfishElo: 1200,
    useElo: true,
    playerColor: 'white',
    showHints: true,
    showArrows: true,
    commentary: true,
    autoAnalyze: true,
  },
  setTrainerSettings: (settings) =>
    set((s) => ({ trainerSettings: { ...s.trainerSettings, ...settings } })),

  // Saved games
  savedGames: [],
  setSavedGames: (games) => set({ savedGames: games }),
  addSavedGame: (game) => set((s) => ({ savedGames: [game, ...s.savedGames] })),

  // Notifications
  notifications: [],
  addNotification: (msg, type = 'info') => {
    const id = Date.now();
    set((s) => ({ notifications: [...s.notifications, { id, msg, type }] }));
    setTimeout(
      () => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
      3500
    );
  },
}));
