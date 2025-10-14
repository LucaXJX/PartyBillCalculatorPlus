/**
 * 頁面設置工具
 * 用於統一設置頁面的 header、footer 和認證功能
 */

class PageSetup {
  constructor() {
    this.authManager = null;
    this.componentManager = null;
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
}

// 創建全局實例
window.pageSetup = new PageSetup();

// 導出類（如果使用模組系統）
if (typeof module !== "undefined" && module.exports) {
  module.exports = PageSetup;
}
