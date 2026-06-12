import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // App state
  activeTab: 'play', // 'play' | 'analyze' | 'puzzles' | 'library'
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Settings
  apiKey: localStorage.getItem('cc_apikey') || '',
  setApiKey: (key) => { localStorage.setItem('cc_apikey', key); set({ apiKey: key }); },

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
  setTrainerSettings: (settings) => set(s => ({
    trainerSettings: { ...s.trainerSettings, ...settings }
  })),

  // Saved games
  savedGames: [],
  setSavedGames: (games) => set({ savedGames: games }),
  addSavedGame: (game) => set(s => ({ savedGames: [game, ...s.savedGames] })),

  // Notifications
  notifications: [],
  addNotification: (msg, type = 'info') => {
    const id = Date.now();
    set(s => ({ notifications: [...s.notifications, { id, msg, type }] }));
    setTimeout(() => set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })), 3500);
  },
}));
