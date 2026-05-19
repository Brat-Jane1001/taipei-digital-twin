/**
 * AuthService - 使用者認證與偏好設定服務
 * 管理登入狀態與組長要求的 Google 帳號連結
 */

const API_BASE = 'https://taipei-backend-ib04.onrender.com';

class AuthService {
  constructor() {
    // 預設的模擬使用者資料（包含個人偏好標籤）
    this.currentUser = null;
    this.userPreferences = {
      interests: ['culture'], // 預設只喜歡文化，之後可以讓用戶勾選更新
    };
  }

  // 模擬連結 Google 帳號
  async loginWithGoogle() {
    try {
      // 這裡先寫好未來串接組長後端 /api/auth/google 的預留邏輯
      // const res = await fetch(`${API_BASE}/api/auth/google`);
      
      // 模擬後端回傳成功的用戶資料
      this.currentUser = {
        uid: 'google_user_12345',
        name: '台北探險家',
        email: 'taipei.explorer@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      };
      
      return { success: true, user: this.currentUser };
    } catch (e) {
      console.error('Google 登入失敗:', e);
      return { success: false, error: e.message };
    }
  }

  // 取得目前用戶的偏好設定 (丟給 EventService 算分數用)
  getPreferences() {
    return this.userPreferences;
  }

  // 更新個人偏好景點標籤
  updatePreferences(newInterests) {
    this.userPreferences.interests = newInterests;
    console.log('偏好景點已更新為:', this.userPreferences.interests);
    return { success: true };
  }

  // 登出
  logout() {
    this.currentUser = null;
    this.userPreferences = { interests: [] };
  }
}

export default new AuthService();