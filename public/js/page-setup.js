/**
 * 頁面設置工具
 * 用於統一設置頁面的 header、footer 和認證功能
 */

class PageSetup {
  constructor() {
    this.authManager = null;
    this.componentManager = null;
    this.pollingInterval = null;
  }

  /**
   * 初始化頁面設置
   * @param {Object} config - 頁面配置
   */
  async init(config = {}) {
    const {
      currentPage = "",
      requireAuth = true,
      showHeader = true,
      showFooter = true,
      headerOptions = {},
      footerOptions = {},
    } = config;

    // 等待認證管理器加載
    await this.waitForAuthManager();

    // 檢查認證狀態
    if (requireAuth) {
      const isAuthenticated = this.authManager.isAuthenticated();

      if (!isAuthenticated) {
        // 延遲重定向，讓用戶看到頁面內容
        setTimeout(() => {
          this.authManager.redirectToLogin();
        }, 100);
        return false;
      }
    }

    // 初始化組件管理器
    this.componentManager = window.componentManager;
    this.componentManager.init(this.authManager);

    // 渲染頁面組件
    this.renderPageComponents({
      currentPage,
      showHeader,
      showFooter,
      headerOptions,
      footerOptions,
    });

    // 啟動未讀消息數量輪詢（如果已登錄）
    if (this.authManager.isAuthenticated()) {
      // 立即加載一次
      this.loadUnreadMessageCount();

      // 啟動定時輪詢（每 10 秒檢查一次，確保用戶及時看到新消息）
      this.startUnreadCountPolling(10000);
    }

    return true;
  }

  /**
   * 等待認證管理器加載
   */
  async waitForAuthManager() {
    return new Promise((resolve) => {
      const checkAuthManager = () => {
        if (window.authManager) {
          this.authManager = window.authManager;
          resolve();
        } else {
          setTimeout(checkAuthManager, 100);
        }
      };
      checkAuthManager();
    });
  }

  /**
   * 渲染頁面組件
   * @param {Object} config - 組件配置
   */
  renderPageComponents(config) {
    const {
      currentPage,
      showHeader,
      showFooter,
      headerOptions,
      footerOptions,
    } = config;

    if (showHeader) {
      this.componentManager.render("header", "body", {
        currentPage,
        ...headerOptions,
      });
    }

    if (showFooter) {
      this.componentManager.render("footer", "body", footerOptions);
    }
  }

  /**
   * 設置頁面特定的功能
   * @param {Object} options - 功能選項
   */
  setupPageFeatures(options = {}) {
    const {
      updateUserDisplay = true,
      setupLogout = true,
      setupAuthCheck = true,
    } = options;

    if (updateUserDisplay && this.authManager) {
      this.authManager.updateUserDisplay();
    }

    if (setupLogout && this.authManager) {
      this.authManager.setupLogoutButton();
    }

    if (setupAuthCheck && this.authManager) {
      this.authManager.setupAuthCheck();
    }
  }

  /**
   * 加載未讀消息數量
   */
  async loadUnreadMessageCount() {
    try {
      const sessionId = localStorage.getItem("sessionId");
      if (!sessionId) return;

      const response = await fetch("/api/messages/unread-count", {
        headers: {
          Authorization: `Bearer ${sessionId}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (this.componentManager) {
          this.componentManager.updateUnreadCount(data.count || 0);
        }
      }
    } catch (error) {
      console.error("加載未讀消息數量失敗:", error);
    }
  }

  /**
   * 開始定時輪詢未讀消息數量
   * @param {number} interval - 輪詢間隔（毫秒），默認 30 秒
   */
  startUnreadCountPolling(interval = 30000) {
    // 清除已存在的輪詢
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // 立即執行一次
    this.loadUnreadMessageCount();

    // 設置定時輪詢
    this.pollingInterval = setInterval(() => {
      this.loadUnreadMessageCount();
    }, interval);

    console.log(`✅ 已啟動未讀消息輪詢，間隔 ${interval / 1000} 秒`);
  }

  /**
   * 停止定時輪詢
   */
  stopUnreadCountPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("⏸️ 已停止未讀消息輪詢");
    }
  }
}

// 創建全局實例供非模組使用
if (typeof window !== "undefined") {
  window.PageSetup = PageSetup;
  window.pageSetup = new PageSetup(); // 創建實例
}

// ES 模組導出（用於支持 import）
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = PageSetup;
}
