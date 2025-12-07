/**
 * 共享組件管理模組
 * 用於統一管理 header、footer 和其他共享 UI 組件
 */

class ComponentManager {
  constructor() {
    this.components = new Map();
    this.authManager = null;
  }

  /**
   * 初始化組件管理器
   * @param {Object} authManager - 認證管理器實例
   */
  init(authManager) {
    this.authManager = authManager;
    this.loadComponents();
  }

  /**
   * 加載所有組件
   */
  loadComponents() {
    this.loadHeader();
    this.loadFooter();
  }

  /**
   * 生成 Header HTML
   * @param {Object} options - 配置選項
   * @returns {string} Header HTML
   */
  generateHeader(options = {}) {
    const {
      currentPage = "",
      showCalculator = true,
      showMyBills = true,
      showContact = true,
      isHomePage = false, // 是否為首頁
      isPublicPage = false, // 是否為公開頁面（法律頁面等）
    } = options;

    // 檢查用戶是否已登入
    const isAuthenticated =
      this.authManager && this.authManager.isAuthenticated();

    // 首頁或公開頁面使用相同的 header 邏輯
    if (isHomePage || isPublicPage) {
      return this.generateHomePageHeader(isAuthenticated);
    } else {
      return this.generateAuthenticatedHeader(options, isAuthenticated);
    }
  }

  /**
   * 生成首頁 Header (未登入/已登入)
   * @param {boolean} isAuthenticated - 是否已登入
   * @returns {string} Header HTML
   */
  generateHomePageHeader(isAuthenticated) {
    if (isAuthenticated) {
      // 獲取當前用戶並生成頭像（使用 ui-avatars.com API，與主頁一致）
      const currentUser = this.authManager?.getCurrentUser();
      const username = currentUser?.username || "用戶";
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        username
      )}&background=4F46E5&color=fff`;

      // 已登入的首頁 header
      return `
        <!-- 頂部導航欄 - 已登入首頁 -->
        <header class="fixed w-full bg-white shadow-sm z-50 transition-all duration-300">
          <div class="container mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16 md:h-20">
              <!-- 網站標誌 -->
              <div class="flex items-center">
                <a href="/index.html" class="flex items-center space-x-2">
                  <img src="/img/icon499x499.png" alt="PBC聚賬通標誌" class="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 object-contain">
                  <span class="text-lg sm:text-xl font-bold text-primary">PBC聚賬通</span>
                </a>
              </div>

              <!-- 導航鏈接 - 桌面版 -->
              <nav class="hidden md:flex items-center space-x-8">
                <a href="#features" class="text-gray-600 hover:text-primary transition-colors">功能</a>
                <a href="#testimonials" class="text-gray-600 hover:text-primary transition-colors">用戶評價</a>
                <a href="#contact" class="text-gray-600 hover:text-primary transition-colors">聯絡我們</a>
              </nav>

              <!-- 已登入用戶操作 -->
              <div class="flex items-center space-x-4">
                <a href="/calculator.html" class="btn-primary text-sm">
                  <i class="fa fa-calculator mr-2"></i>開始計算
                </a>
                <div class="relative group">
                  <button class="flex items-center space-x-2 focus:outline-none">
                    <img src="${avatarUrl}" alt="用戶頭像" class="w-10 h-10 rounded-full object-cover border-2 border-primary/20">
                    <span class="hidden sm:inline-block font-medium user-name-display">${username}</span>
                    <i class="fa fa-angle-down text-gray-500 group-hover:text-primary transition-colors"></i>
                  </button>
                  <!-- 下拉菜單 -->
                  <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 translate-y-2">
                    <a href="/my-bills.html" class="block px-4 py-2 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors">
                      <i class="fa fa-file-text mr-2"></i>我的賬單
                    </a>
                    <a href="/messages.html" class="block px-4 py-2 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors">
                      <i class="fa fa-envelope mr-2"></i>我的消息
                    </a>
                    <a href="/settings.html" class="block px-4 py-2 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors">
                      <i class="fa fa-cog mr-2"></i>設置
                    </a>
                    <div class="border-t border-gray-100 my-1"></div>
                    <a href="#" id="logout-btn" class="block px-4 py-2 text-red-500 hover:bg-red-50 transition-colors">
                      <i class="fa fa-sign-out mr-2"></i>退出登入
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      `;
    } else {
      // 未登入的首頁 header
      return `
        <!-- 頂部導航欄 - 未登入首頁 -->
        <header class="fixed w-full bg-gradient-to-r from-primary/10 via-white to-secondary/10 shadow-sm z-50 transition-all duration-300">
          <div class="container mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16 md:h-20">
              <!-- 網站標誌 -->
              <div class="flex items-center">
                <a href="/index.html" class="flex items-center space-x-2">
                  <img src="/img/icon499x499.png" alt="PBC聚賬通標誌" class="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 object-contain">
                  <span class="text-lg sm:text-xl font-bold text-primary">PBC聚賬通</span>
                </a>
              </div>

              <!-- 導航鏈接 - 桌面版 -->
              <nav class="hidden md:flex items-center space-x-8">
                <a href="#features" class="text-gray-600 hover:text-primary transition-colors">功能</a>
                <a href="#testimonials" class="text-gray-600 hover:text-primary transition-colors">用戶評價</a>
                <a href="#contact" class="text-gray-600 hover:text-primary transition-colors">聯絡我們</a>
              </nav>

              <!-- 登入/註冊按鈕 -->
              <div class="flex items-center space-x-2 sm:space-x-4">
                <a href="/login-page.html" class="text-sm sm:text-base text-gray-600 hover:text-primary transition-colors">登入</a>
                <a href="/registration-page.html" class="text-sm sm:text-base bg-accent text-white font-semibold py-2 px-4 sm:py-3 sm:px-6 rounded-full shadow-md hover:shadow-lg hover:bg-amber-600 transition-all duration-300">註冊</a>
                
                <!-- 移動端菜單按鈕 -->
                <button id="menu-toggle" class="md:hidden text-gray-600 hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="開啟選單">
                  <i class="fa fa-bars text-xl"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- 移动端菜单 -->
          <div id="mobile-menu" class="md:hidden hidden bg-white border-t">
            <div class="container mx-auto px-4 py-3 space-y-3">
              <a href="#features" class="block text-gray-600 hover:text-primary py-2 transition-colors">功能</a>
              <a href="#testimonials" class="block text-gray-600 hover:text-primary py-2 transition-colors">用戶評價</a>
              <a href="#contact" class="block text-gray-600 hover:text-primary py-2 transition-colors">聯絡我們</a>
              <div class="flex space-x-4 pt-2">
                <a href="/login-page.html" class="text-gray-600 hover:text-primary transition-colors">登入</a>
                <a href="/registration-page.html" class="btn-primary">立即註冊</a>
              </div>
            </div>
          </div>
        </header>
      `;
    }
  }

  /**
   * 生成已登入頁面 Header (功能頁面)
   * @param {Object} options - 配置選項
   * @param {boolean} isAuthenticated - 是否已登入
   * @returns {string} Header HTML
   */
  generateAuthenticatedHeader(options, isAuthenticated) {
    const {
      currentPage = "",
      showCalculator = true,
      showMyBills = true,
      showContact = true,
    } = options;

    return `
      <!-- 頂部導航欄 - 功能頁面 -->
      <header id="navbar" class="fixed w-full bg-white shadow-sm z-50 transition-all duration-300">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16 md:h-20">
            <!-- 網站標誌 -->
            <div class="flex items-center">
              <a href="/index.html" id="logo-link" class="flex items-center space-x-2">
                <img src="/img/icon499x499.png" alt="PBC聚賬通標誌" class="h-10 w-10 md:h-12 md:w-12 object-contain">
                <span class="text-xl font-bold text-primary">PBC聚賬通</span>
              </a>
            </div>

            <!-- 導航鏈接 - 桌面版 -->
            <nav class="hidden md:flex items-center space-x-8">
              ${
                showCalculator
                  ? `
                <a href="/calculator.html" class="${
                  currentPage === "calculator"
                    ? "text-primary font-medium"
                    : "text-gray-600 hover:text-primary transition-colors"
                }">
                  <i class="fa fa-calculator mr-1"></i>智能計算
                </a>
              `
                  : ""
              }
              ${
                showMyBills
                  ? `
                <a href="/my-bills.html" class="${
                  currentPage === "my-bills"
                    ? "text-primary font-medium"
                    : "text-gray-600 hover:text-primary transition-colors"
                }">
                  <i class="fa fa-file-text mr-1"></i>我的賬單
                </a>
              `
                  : ""
              }
              ${
                showContact
                  ? `
                <a href="/messages.html" class="${
                  currentPage === "messages"
                    ? "text-primary font-medium"
                    : "text-gray-600 hover:text-primary transition-colors"
                } relative">
                  <i class="fa fa-envelope mr-1"></i>我的消息
                  <span id="message-badge" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" style="display: none"></span>
                </a>
              `
                  : ""
              }
            </nav>

            <!-- 用戶頭像和下拉菜單 -->
            <div class="flex items-center space-x-4">
              <!-- 移動端菜單按鈕 -->
              <button id="menu-toggle" class="md:hidden text-gray-600 hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="開啟選單">
                <i class="fa fa-bars text-xl"></i>
              </button>

              <!-- 用戶頭像和下拉菜單 -->
              <div class="relative group">
                <button class="flex items-center space-x-2 focus:outline-none">
                  <img src="${`https://ui-avatars.com/api/?name=${encodeURIComponent(
                    this.authManager?.getCurrentUser()?.username || "用戶"
                  )}&background=4F46E5&color=fff`}" alt="用戶頭像" class="w-10 h-10 rounded-full object-cover border-2 border-primary/20">
                  <span class="hidden sm:inline-block font-medium user-name-display">${
                    this.authManager?.getCurrentUser()?.username || "用戶"
                  }</span>
                  <i class="fa fa-angle-down text-gray-500 group-hover:text-primary transition-colors"></i>
                </button>
                <!-- 下拉菜單 -->
                <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 translate-y-2">
                  <a href="/settings.html" class="block px-4 py-2 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors">
                    <i class="fa fa-cog mr-2"></i>設置
                  </a>
                  <div class="text-xs text-gray-500 px-4 py-1">修改密碼、用戶名、郵箱</div>
                  <div class="border-t border-gray-100 my-1"></div>
                  <a href="#" id="logout-btn" class="block px-4 py-2 text-red-500 hover:bg-red-50 transition-colors">
                    <i class="fa fa-sign-out mr-2"></i>退出登入
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 移動端菜單 -->
        <div id="mobile-menu" class="md:hidden hidden bg-white border-t">
          <div class="container mx-auto px-4 py-3 space-y-3">
            ${
              showCalculator
                ? `
              <a href="/calculator.html" class="${
                currentPage === "calculator"
                  ? "block text-primary font-medium py-2"
                  : "block text-gray-600 hover:text-primary py-2 transition-colors"
              }">
                <i class="fa fa-calculator mr-2"></i>智能計算
              </a>
            `
                : ""
            }
            ${
              showMyBills
                ? `
              <a href="/my-bills.html" class="${
                currentPage === "my-bills"
                  ? "block text-primary font-medium py-2"
                  : "block text-gray-600 hover:text-primary py-2 transition-colors"
              }">
                <i class="fa fa-file-text mr-2"></i>我的賬單
              </a>
            `
                : ""
            }
            ${
              showContact
                ? `
              <a href="/messages.html" class="${
                currentPage === "messages"
                  ? "block text-primary font-medium py-2"
                  : "block text-gray-600 hover:text-primary py-2 transition-colors"
              }">
                <i class="fa fa-envelope mr-2"></i>我的消息
              </a>
            `
                : ""
            }
            <div class="border-t border-gray-200 my-2"></div>
            <a href="/settings.html" class="block text-gray-600 hover:text-primary py-2 transition-colors">
              <i class="fa fa-cog mr-2"></i>設置
            </a>
            <a href="#" id="logout-btn-mobile" class="block text-red-500 hover:bg-red-50 py-2 transition-colors">
              <i class="fa fa-sign-out mr-2"></i>退出登入
            </a>
          </div>
        </div>
      </header>
    `;
  }

  /**
   * 生成 Footer HTML
   * @returns {string} Footer HTML
   */
  generateFooter() {
    return `
      <!-- 頁腳 -->
      <footer class="text-white pt-12 pb-8 relative z-10" style="background-color: #1f2937 !important; color: white !important;">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <!-- web info -->
            <div>
              <div class="flex items-center space-x-2 mb-6">
                <i class="fa fa-calculator text-primary text-2xl"></i>
                <span class="text-xl font-bold">PBC聚賬通</span>
              </div>
              <p class="text-gray-400 mb-6">
                讓聚會帳單分攤變得簡單公平，提升社交體驗的必備工具。
              </p>
            </div>

            <!-- 快速連結 -->
            <div>
              <h4 class="text-lg font-semibold mb-6">快速連結</h4>
              <ul class="space-y-3">
                <li>
                  <a href="/index.html" class="text-gray-400 hover:text-white transition-colors">首頁</a>
                </li>
                <li>
                  <a href="/calculator.html" class="text-gray-400 hover:text-white transition-colors">智能計算</a>
                </li>
                <li>
                  <a href="/my-bills.html" class="text-gray-400 hover:text-white transition-colors">我的賬單</a>
                </li>
                <li>
                  <a href="#contact" class="text-gray-400 hover:text-white transition-colors">聯絡我們</a>
                </li>
              </ul>
            </div>

            <!-- 聯絡我們 -->
            <div>
              <h4 class="text-lg font-semibold mb-6">聯絡我們</h4>
              <ul class="space-y-3">
                <li class="flex items-center">
                  <i class="fa fa-envelope text-gray-400 mr-3" style="min-width: 1.2rem;"></i>
                  <span class="text-gray-400 break-words">support@pbcapp.com</span>
                </li>
                <li class="flex items-center">
                  <i class="fa fa-phone text-gray-400 mr-3" style="min-width: 1.2rem;"></i>
                  <span class="text-gray-400">852-1234-5678</span>
                </li>
                <li class="flex items-start">
                  <i class="fa fa-map-marker text-gray-400 mt-1 mr-3" style="min-width: 1.2rem;"></i>
                  <span class="text-gray-400 break-words">香港專業進修學校 應用教育文憑 智能科技應用及手機程式設計 專題研習</span>
                </li>
              </ul>
            </div>

            <!-- 法律信息 -->
            <div>
              <h4 class="text-lg font-semibold mb-6">法律信息</h4>
              <ul class="space-y-3">
                <li>
                  <a href="/privacy-policy.html" class="text-gray-400 hover:text-white transition-colors">個人資料私隱政策</a>
                </li>
                <li>
                  <a href="/disclaimer.html" class="text-gray-400 hover:text-white transition-colors">免責條例</a>
                </li>
                <li>
                  <a href="/copyright.html" class="text-gray-400 hover:text-white transition-colors">版權聲明</a>
                </li>
              </ul>
            </div>
          </div>

          <div class="border-t border-gray-800 pt-8 text-center text-gray-500">
            <p>&copy; 2025 PBC聚賬通. 保留所有權利</p>
          </div>
        </div>
      </footer>
    `;
  }

  /**
   * 加載 Header 組件
   */
  loadHeader() {
    this.components.set("header", this.generateHeader);
  }

  /**
   * 加載 Footer 組件
   */
  loadFooter() {
    this.components.set("footer", this.generateFooter);
  }

  /**
   * 渲染組件到指定元素
   * @param {string} componentName - 組件名稱
   * @param {string} targetSelector - 目標選擇器
   * @param {Object} options - 配置選項
   */
  render(componentName, targetSelector, options = {}) {
    const componentGenerator = this.components.get(componentName);
    if (!componentGenerator) {
      console.error(`組件 "${componentName}" 不存在`);
      return;
    }

    const targetElement = document.querySelector(targetSelector);
    if (!targetElement) {
      console.error(`目標元素 "${targetSelector}" 不存在`);
      return;
    }

    const html = componentGenerator.call(this, options);

    // 對於 body 元素，使用 insertAdjacentHTML 來插入組件
    if (targetSelector === "body") {
      if (componentName === "header") {
        // 在 body 開始處插入 header
        targetElement.insertAdjacentHTML("afterbegin", html);
      } else if (componentName === "footer") {
        // 在 body 結束前插入 footer
        targetElement.insertAdjacentHTML("beforeend", html);
      }
    } else {
      // 對於其他元素，使用 innerHTML
      targetElement.innerHTML = html;
    }

    // 如果是 header，設置認證相關功能
    if (componentName === "header" && this.authManager) {
      this.setupHeaderAuth();
    }
  }

  /**
   * 設置 Header 的認證功能
   */
  setupHeaderAuth() {
    if (!this.authManager) return;

    // 更新用戶顯示
    this.authManager.updateUserDisplay();

    // 設置登出功能
    this.authManager.setupLogoutButton();

    // 設置移動端登出按鈕
    this.setupMobileLogout();

    // 設置下拉菜單功能
    this.setupDropdownMenu();

    // 設置移動端菜單切換功能
    this.setupMobileMenu();
  }

  /**
   * 設置下拉菜單的交互功能
   */
  setupDropdownMenu() {
    // 等待 DOM 更新
    setTimeout(() => {
      const dropdownButton = document.querySelector(".relative.group button");
      const dropdownMenu = document.querySelector(".relative.group .absolute");

      if (dropdownButton && dropdownMenu) {
        let isOpen = false;

        // 點擊按鈕切換下拉菜單
        dropdownButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          isOpen = !isOpen;

          if (isOpen) {
            dropdownMenu.classList.remove(
              "opacity-0",
              "invisible",
              "translate-y-2"
            );
            dropdownMenu.classList.add(
              "opacity-100",
              "visible",
              "translate-y-0"
            );
          } else {
            dropdownMenu.classList.add(
              "opacity-0",
              "invisible",
              "translate-y-2"
            );
            dropdownMenu.classList.remove(
              "opacity-100",
              "visible",
              "translate-y-0"
            );
          }
        });

        // 點擊外部關閉下拉菜單
        document.addEventListener("click", (e) => {
          if (
            !dropdownButton.contains(e.target) &&
            !dropdownMenu.contains(e.target)
          ) {
            isOpen = false;
            dropdownMenu.classList.add(
              "opacity-0",
              "invisible",
              "translate-y-2"
            );
            dropdownMenu.classList.remove(
              "opacity-100",
              "visible",
              "translate-y-0"
            );
          }
        });

        // 鍵盤支持
        dropdownButton.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            dropdownButton.click();
          }
        });
      }
    }, 100);
  }

  /**
   * 設置移動端菜單切換功能
   */
  setupMobileMenu() {
    setTimeout(() => {
      const menuToggle = document.getElementById("menu-toggle");
      const mobileMenu = document.getElementById("mobile-menu");

      if (menuToggle && mobileMenu) {
        menuToggle.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          mobileMenu.classList.toggle("hidden");
        });

        // 點擊菜單項後關閉菜單
        const menuLinks = mobileMenu.querySelectorAll("a");
        menuLinks.forEach((link) => {
          link.addEventListener("click", () => {
            // 如果不是登出按鈕，關閉菜單
            if (!link.id.includes("logout")) {
              mobileMenu.classList.add("hidden");
            }
          });
        });

        // 點擊外部關閉菜單
        document.addEventListener("click", (e) => {
          if (
            !menuToggle.contains(e.target) &&
            !mobileMenu.contains(e.target)
          ) {
            mobileMenu.classList.add("hidden");
          }
        });
      }
    }, 100);
  }

  /**
   * 設置移動端登出按鈕
   */
  setupMobileLogout() {
    setTimeout(() => {
      const logoutBtnMobile = document.getElementById("logout-btn-mobile");
      if (logoutBtnMobile && this.authManager) {
        logoutBtnMobile.addEventListener("click", async (e) => {
          e.preventDefault();
          await this.authManager.logout();
        });
      }
    }, 100);
  }

  /**
   * 渲染頁面佈局
   * @param {Object} config - 頁面配置
   */
  renderPage(config = {}) {
    const {
      currentPage = "",
      showHeader = true,
      showFooter = true,
      headerOptions = {},
      footerOptions = {},
    } = config;

    if (showHeader) {
      this.render("header", "body", { currentPage, ...headerOptions });
    }

    if (showFooter) {
      this.render("footer", "body", footerOptions);
    }
  }

  /**
   * 更新未讀消息數量
   * @param {number} count - 未讀消息數量
   */
  updateUnreadCount(count) {
    const badge = document.getElementById("message-badge");
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? "99+" : count;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }
  }
}

// 創建全局實例
window.componentManager = new ComponentManager();

// 導出類（如果使用模組系統，僅在 Node.js 環境中）
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = ComponentManager;
}
