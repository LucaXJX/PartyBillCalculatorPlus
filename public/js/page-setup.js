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

  /**
   * 測試消息功能 - 手動觸發逾期提醒檢查
   */
  async testOverdueReminder() {
    try {
      console.log("🔍 測試逾期提醒功能...");
      const response = await this.authManager.authenticatedFetch(
        "/api/admin/trigger-overdue-check",
        { method: "POST" }
      );
      
      if (response && response.ok) {
        const result = await response.json();
        console.log("✅ 逾期提醒檢查完成:", result);
        return result;
      } else {
        console.error("❌ 逾期提醒檢查失敗:", response?.status);
        return null;
      }
    } catch (error) {
      console.error("❌ 逾期提醒檢查錯誤:", error);
      return null;
    }
  }

  /**
   * 測試消息功能 - 發送測試消息
   */
  async sendTestMessage(type = "info", content = "這是一條測試消息") {
    try {
      console.log(`📤 發送測試消息 (${type}):`, content);
      const response = await this.authManager.authenticatedFetch(
        "/api/messages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: type,
            content: content,
            billId: null,
            relatedUserId: null
          })
        }
      );
      
      if (response && response.ok) {
        const result = await response.json();
        console.log("✅ 測試消息發送成功:", result);
        return result;
      } else {
        console.error("❌ 測試消息發送失敗:", response?.status);
        return null;
      }
    } catch (error) {
      console.error("❌ 測試消息發送錯誤:", error);
      return null;
    }
  }

  /**
   * 測試消息功能 - 獲取所有消息
   */
  async getAllMessages() {
    try {
      console.log("📥 獲取所有消息...");
      const response = await this.authManager.authenticatedFetch("/api/messages");
      
      if (response && response.ok) {
        const messages = await response.json();
        console.log("✅ 消息獲取成功:", messages);
        return messages;
      } else {
        console.error("❌ 消息獲取失敗:", response?.status);
        return null;
      }
    } catch (error) {
      console.error("❌ 消息獲取錯誤:", error);
      return null;
    }
  }

  /**
   * 測試消息功能 - 標記消息為已讀
   */
  async markMessageAsRead(messageId) {
    try {
      console.log("✅ 標記消息為已讀:", messageId);
      const response = await this.authManager.authenticatedFetch(
        `/api/messages/${messageId}/read`,
        { method: "POST" }
      );
      
      if (response && response.ok) {
        const result = await response.json();
        console.log("✅ 消息已標記為已讀:", result);
        return result;
      } else {
        console.error("❌ 標記消息失敗:", response?.status);
        return null;
      }
    } catch (error) {
      console.error("❌ 標記消息錯誤:", error);
      return null;
    }
  }

  /**
   * 測試消息功能 - 設置輪詢間隔
   */
  setPollingInterval(seconds) {
    console.log(`⏰ 設置輪詢間隔為 ${seconds} 秒`);
    this.stopUnreadCountPolling();
    this.startUnreadCountPolling(seconds * 1000);
  }

  /**
   * 測試消息功能 - 手動觸發輪詢
   */
  async triggerPolling() {
    console.log("🔄 手動觸發輪詢...");
    await this.loadUnreadMessageCount();
  }
}

// 創建全局實例供非模組使用
if (typeof window !== "undefined") {
  window.PageSetup = PageSetup;
  window.pageSetup = new PageSetup(); // 創建實例

  // 添加全局測試函數
  window.testMessageSystem = {
    // 測試逾期提醒
    async testOverdue() {
      return await window.pageSetup.testOverdueReminder();
    },

    // 發送測試消息
    async sendMessage(type = "info", content = "這是一條測試消息") {
      return await window.pageSetup.sendTestMessage(type, content);
    },

    // 獲取所有消息
    async getMessages() {
      return await window.pageSetup.getAllMessages();
    },

    // 標記消息為已讀
    async markRead(messageId) {
      return await window.pageSetup.markMessageAsRead(messageId);
    },

    // 設置輪詢間隔
    setPolling(seconds) {
      window.pageSetup.setPollingInterval(seconds);
    },

    // 手動觸發輪詢
    async triggerPolling() {
      return await window.pageSetup.triggerPolling();
    },

    // 停止輪詢
    stopPolling() {
      window.pageSetup.stopUnreadCountPolling();
    },

    // 顯示幫助信息
    help() {
      console.log(`
🔧 消息系統測試命令：

📋 基本測試：
  testMessageSystem.testOverdue()           - 測試逾期提醒功能
  testMessageSystem.getMessages()           - 獲取所有消息
  testMessageSystem.triggerPolling()        - 手動觸發輪詢

📤 發送消息：
  testMessageSystem.sendMessage()           - 發送默認測試消息
  testMessageSystem.sendMessage('warning', '警告消息')  - 發送警告消息
  testMessageSystem.sendMessage('error', '錯誤消息')    - 發送錯誤消息

✅ 消息操作：
  testMessageSystem.markRead('messageId')   - 標記消息為已讀

⏰ 輪詢控制：
  testMessageSystem.setPolling(5)           - 設置5秒輪詢間隔
  testMessageSystem.stopPolling()           - 停止輪詢

📖 幫助：
  testMessageSystem.help()                  - 顯示此幫助信息

💡 提示：
  - 確保已登錄後再使用這些命令
  - 查看控制台輸出了解執行結果
  - 可以組合使用多個命令進行測試
      `);
    }
  };

  // 頁面加載完成後顯示測試命令提示
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        console.log(`
🎯 消息系統測試命令已就緒！

輸入 testMessageSystem.help() 查看所有可用命令
或直接使用 testMessageSystem.testOverdue() 測試逾期提醒功能
        `);
      }, 1000);
    });
  } else {
    setTimeout(() => {
      console.log(`
🎯 消息系統測試命令已就緒！

輸入 testMessageSystem.help() 查看所有可用命令
或直接使用 testMessageSystem.testOverdue() 測試逾期提醒功能
      `);
    }, 1000);
  }
}

// ES 模組導出（用於支持 import）
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = PageSetup;
}
