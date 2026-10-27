/**
 * AppStore - Zustand全域狀態管理
 * Global state management with Zustand
 */

import { create } from 'zustand';

export const useAppStore = create((set) => ({
  // 使用者資訊
  user: {
    preferences: {
      interests: ['food', 'culture'], // 預設興趣
    },
  },
  
  // 活動列表
  events: [],
  
  // 當前位置
  currentLocation: null,
  
  // 使用者互動歷史（用於AI學習）
  swipeHistory: [],
  
  // 📍 新增：行程清單 (Itinerary)
  itinerary: [],

  // ==========================================
  // Actions
  // ==========================================
  
  setEvents: (events) => set({ events }),
  
  setCurrentLocation: (location) => set({ currentLocation: location }),
  
  // 📍 新增：行程清單管理 Actions
  addToItinerary: (item) => set((state) => {
    // 檢查是否已經在行程內，避免重複加入
    if (state.itinerary.find(i => i.id === item.id)) return state;
    return { itinerary: [...state.itinerary, item] };
  }),
  
  removeFromItinerary: (itemId) => set((state) => ({
    itinerary: state.itinerary.filter(i => i.id !== itemId)
  })),
  
  reorderItinerary: (newItinerary) => set({ itinerary: newItinerary }),
  
  clearItinerary: () => set({ itinerary: [] }),

  // 原始滑動記錄與 AI 學習功能
  addSwipeHistory: (event, direction) => set((state) => ({
    swipeHistory: [
      ...state.swipeHistory,
      {
        eventId: event.id,
        direction, // 'left' or 'right'
        timestamp: new Date().toISOString(),
        tags: event.tags,
      },
    ],
  })),
  
  updateUserPreferences: (newInterests) => set((state) => ({
    user: {
      ...state.user,
      preferences: {
        ...state.user.preferences,
        interests: newInterests,
      },
    },
  })),
  
  learnFromSwipes: () => set((state) => {
    const { swipeHistory } = state;
    const tagScores = {};
    
    swipeHistory.forEach(swipe => {
      const weight = swipe.direction === 'right' ? 1 : -0.5;
      swipe.tags.forEach(tag => {
        if (!tagScores[tag]) {
          tagScores[tag] = 0;
        }
        tagScores[tag] += weight;
      });
    });
    
    const topTags = Object.entries(tagScores)
      .filter(([_, score]) => score > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([tag, _]) => tag);
    
    return {
      user: {
        ...state.user,
        preferences: {
          ...state.user.preferences,
          interests: topTags,
        },
      },
    };
  }),
}));