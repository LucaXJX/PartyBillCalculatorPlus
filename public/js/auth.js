/**
 * 認證工具模塊
 * 統一管理用戶登入狀態和頁面重定向邏輯
 */

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.sessionId = null;
    this.init();
  }

  /**
   * 初始化認證狀態
   */
  init() {
    this.loadUserFromStorage();
    this.setupAuthCheck();
  }

  /**
   * 從本地存儲加載用戶信息
   */
  loadUserFromStorage() {
    try {
      this.sessionId = localStorage.getItem("sessionId");
      const userData = localStorage.getItem("user");

      if (this.sessionId && userData) {
        this.currentUser = JSON.parse(userData);
        console.log("用戶已從本地存儲加載:", this.currentUser.username);
      }
    } catch (error) {
      console.error("加載用戶數據失敗:", error);
      this.clearAuth();
    }
  }

  /**
   * 檢查用戶是否已登入
   */
  isAuthenticated() {
    return !!(this.sessionId && this.currentUser);
  }

  /**
   * 獲取當前用戶
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 獲取會話ID
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * 設置用戶登入狀態
   */
  setAuth(user, sessionId) {
    this.currentUser = user;
    this.sessionId = sessionId;
    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem("user", JSON.stringify(user));
    console.log("用戶登入狀態已設置:", user.username);
  }

  /**
   * 清除用戶登入狀態
   */
  clearAuth() {
    this.currentUser = null;
    this.sessionId = null;
    localStorage.removeItem("sessionId");
    localStorage.removeItem("user");
    console.log("用戶登入狀態已清除");
  }

  /**
   * 創建帶認證的fetch請求
   */
  async authenticatedFetch(url, options = {}) {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${this.sessionId}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 如果認證失敗，清除本地狀態並重定向
    if (response.status === 401) {
      this.clearAuth();
      this.redirectToLogin();
      return null;
    }

    return response;
  }

  /**
   * 重定向到登入頁面
   */
  redirectToLogin() {
    console.log("重定向到登入頁面");
    window.location.href = "/login-page.html";
  }

  /**
   * 重定向到主頁
   */
  redirectToHome() {
    console.log("重定向到主頁");
    window.location.href = "/index.html";
  }

  /**
   * 重定向到計算器頁面
   */
  redirectToCalculator() {
    console.log("重定向到計算器頁面");
    window.location.href = "/calculator.html";
  }

  /**
   * 登出用戶
   */
  async logout() {
    try {
      if (this.sessionId) {
        await this.authenticatedFetch("/api/auth/logout", { method: "POST" });
      }
    } catch (error) {
      console.error("登出請求失敗:", error);
    } finally {
      this.clearAuth();
      this.redirectToHome();
    }
  }

  /**
   * 設置認證檢查
   */
  setupAuthCheck() {
    // 定期檢查認證狀態
    setInterval(() => {
      if (this.isAuthenticated()) {
        this.validateSession();
      }
    }, 30000); // 每30秒檢查一次
  }

  /**
   * 驗證會話是否有效
   */
  async validateSession() {
    try {
      const response = await this.authenticatedFetch("/api/auth/me");
      if (!response || !response.ok) {
        this.clearAuth();
        this.redirectToLogin();
      }
    } catch (error) {
      console.error("會話驗證失敗:", error);
      this.clearAuth();
      this.redirectToLogin();
    }
  }

  /**
   * 更新用戶名顯示
   */
  updateUserDisplay() {
    const userNameElements = document.querySelectorAll(".user-name-display");
    userNameElements.forEach((element) => {
      if (this.currentUser) {
        element.textContent = this.currentUser.username;
      }
    });

    // 更新用戶頭像區域
    const userAvatar = document.querySelector('img[alt="用戶頭像"]');
    if (userAvatar && this.currentUser) {
      // 可以根據用戶名生成頭像或使用默認頭像
      userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        this.currentUser.username
      )}&background=4F46E5&color=fff`;
    }
  }

  /**
   * 設置登出按鈕事件
   */
  setupLogoutButton() {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.logout();
      });
      console.log("登出按鈕事件已設置");
    }
  }

  /**
   * 根據頁面類型進行認證檢查
   */
  checkPageAuth(pageType) {
    const isAuth = this.isAuthenticated();

    switch (pageType) {
      case "public":
        // 公開頁面，不需要認證
        break;
      case "protected":
        // 受保護頁面，需要認證
        if (!isAuth) {
          this.redirectToLogin();
          return false;
        }
        break;
      case "auth":
        // 認證頁面（登入/註冊），如果已登入則重定向
        if (isAuth) {
          this.redirectToCalculator();
          return false;
        }
        break;
    }

    return true;
  }
}

// 創建全局認證管理器實例
window.authManager = new AuthManager();

// 導出供其他模塊使用
if (typeof module !== "undefined" && module.exports) {
  module.exports = AuthManager;
}
