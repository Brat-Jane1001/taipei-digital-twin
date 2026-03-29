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
  
  // Actions
  setEvents: (events) => set({ events }),
  
  setCurrentLocation: (location) => set({ currentLocation: location }),
  
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
  
  // 根據滑動歷史學習使用者偏好
  learnFromSwipes: () => set((state) => {
    const { swipeHistory } = state;
    
    // 統計每個標籤的喜好度
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
    
    // 取得分數最高的標籤作為興趣
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