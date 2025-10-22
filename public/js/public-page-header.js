/**
 * 公開頁面 Header 管理
 * 用於法律頁面（隱私政策、免責條款、版權聲明）等公開頁面
 * 根據登入狀態動態調整 header 內容
 */

(function () {
  /**
   * 轉義 HTML 特殊字符以防止 XSS 攻擊
   */
  function escapeHtml(text) {
    if (text == null) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  // 頁面加載時檢查登錄狀態並更新 header
  window.addEventListener("DOMContentLoaded", async () => {
    console.log("公開頁面 Header 初始化...");

    // 等待 authManager 加載
    const waitForAuthManager = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (window.authManager) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    };

    await waitForAuthManager();

    const user = window.authManager?.getCurrentUser();
    const isAuthenticated = window.authManager?.isAuthenticated();

    console.log("登入狀態:", isAuthenticated, "用戶:", user);

    // 獲取 header 中的元素
    const navUserSection = document.getElementById("nav-user-section");
    const loginBtn = document.getElementById("login-btn");
    const registerBtn = document.getElementById("register-btn");
    const menuToggle = document.getElementById("menu-toggle");

    if (isAuthenticated && user) {
      console.log("用戶已登入，更新 header...");

      // 使用 ui-avatars.com API 生成基於用戶名的頭像（與主頁一致）
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.username
      )}&background=4F46E5&color=fff`;

      // 用戶已登錄，創建用戶菜單
      const userMenuHTML = `
        <a href="/calculator.html" class="btn-primary text-sm min-h-[44px] flex items-center justify-center">
          <i class="fa fa-calculator mr-2"></i>開始計算
        </a>
        <div class="relative group">
          <button class="flex items-center space-x-2 focus:outline-none min-w-[44px] min-h-[44px]">
            <img src="${avatarUrl}" alt="用戶頭像" class="w-10 h-10 rounded-full object-cover border-2 border-primary/20">
            <span class="hidden sm:inline-block font-medium user-name-display">${escapeHtml(
              user.username
            )}</span>
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
            <a href="#" id="logout-btn-public" class="block px-4 py-2 text-red-500 hover:bg-red-50 transition-colors">
              <i class="fa fa-sign-out mr-2"></i>退出登入
            </a>
          </div>
        </div>
      `;

      // 替換 nav-user-section 的內容
      if (navUserSection) {
        navUserSection.innerHTML = userMenuHTML;

        // 設置登出功能
        setTimeout(() => {
          const logoutBtn = document.getElementById("logout-btn-public");
          if (logoutBtn) {
            logoutBtn.addEventListener("click", async (e) => {
              e.preventDefault();
              await window.authManager.logout();
            });
          }

          // 設置下拉菜單的點擊交互（移動端）
          const dropdownButton = navUserSection.querySelector(
            ".relative.group button"
          );
          const dropdownMenu = navUserSection.querySelector(
            ".relative.group .absolute"
          );

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
                dropdownMenu.classList.add("opacity-100", "visible");
              } else {
                dropdownMenu.classList.add(
                  "opacity-0",
                  "invisible",
                  "translate-y-2"
                );
                dropdownMenu.classList.remove("opacity-100", "visible");
              }
            });

            // 點擊外部關閉下拉菜單
            document.addEventListener("click", (e) => {
              if (!navUserSection.contains(e.target) && isOpen) {
                isOpen = false;
                dropdownMenu.classList.add(
                  "opacity-0",
                  "invisible",
                  "translate-y-2"
                );
                dropdownMenu.classList.remove("opacity-100", "visible");
              }
            });
          }
        }, 100);
      }

      // 更新移動端菜單
      const mobileMenu = document.getElementById("mobile-menu");
      if (mobileMenu) {
        const mobileMenuContent = mobileMenu.querySelector(".space-y-3");
        if (mobileMenuContent) {
          mobileMenuContent.innerHTML = `
            <a href="/calculator.html" class="block btn-primary">
              <i class="fa fa-calculator mr-2"></i>開始計算
            </a>
            <a href="/my-bills.html" class="block text-gray-600 hover:text-primary py-2 transition-colors">
              <i class="fa fa-file-text mr-2"></i>我的賬單
            </a>
            <a href="/messages.html" class="block text-gray-600 hover:text-primary py-2 transition-colors">
              <i class="fa fa-envelope mr-2"></i>我的消息
            </a>
            <a href="/settings.html" class="block text-gray-600 hover:text-primary py-2 transition-colors">
              <i class="fa fa-cog mr-2"></i>設置
            </a>
            <div class="border-t border-gray-200 my-2"></div>
            <a href="#" id="logout-btn-mobile-public" class="block text-red-500 hover:bg-red-50 py-2 transition-colors">
              <i class="fa fa-sign-out mr-2"></i>退出登入
            </a>
          `;

          // 設置移動端登出功能
          setTimeout(() => {
            const logoutBtnMobile = document.getElementById(
              "logout-btn-mobile-public"
            );
            if (logoutBtnMobile) {
              logoutBtnMobile.addEventListener("click", async (e) => {
                e.preventDefault();
                await window.authManager.logout();
              });
            }
          }, 100);
        }
      }
    } else {
      console.log("用戶未登入，顯示登入/註冊按鈕");

      // 用戶未登錄，確保顯示登入/註冊按鈕
      if (loginBtn) {
        loginBtn.classList.remove("hidden");
      }
      if (registerBtn) {
        registerBtn.classList.remove("hidden");
      }
    }
  });

  // 移動端菜單切換功能
  document.addEventListener("click", function (e) {
    if (e.target.closest("#menu-toggle")) {
      e.preventDefault();
      const mobileMenu = document.getElementById("mobile-menu");
      if (mobileMenu) {
        mobileMenu.classList.toggle("hidden");
      }
    }
  });
})();
