/**
 * 頁面過渡動畫系統
 * 為頁面切換添加平滑的淡入淡出效果
 */

(function () {
  // 頁面進入時的淡入動畫已經在 CSS 中定義
  // 這裡處理頁面離開時的淡出動畫

  // 為所有內部鏈接添加過渡效果
  function setupPageTransitions() {
    // 獲取所有內部鏈接
    const links = document.querySelectorAll(
      'a[href^="/"], a[href^="./"], a[href^="../"]'
    );

    links.forEach((link) => {
      link.addEventListener("click", function (e) {
        const href = this.getAttribute("href");

        // 排除特殊情況
        if (
          !href ||
          href === "#" ||
          href.startsWith("#") ||
          this.target === "_blank" ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey
        ) {
          return;
        }

        e.preventDefault();

        // 添加淡出動畫
        document.body.style.opacity = "1";
        document.body.style.transition = "opacity 0.3s ease-out";

        setTimeout(() => {
          document.body.style.opacity = "0";
        }, 10);

        // 300ms 後跳轉（與動畫時間匹配）
        setTimeout(() => {
          window.location.href = href;
        }, 300);
      });
    });
  }

  // 為表單提交添加過渡效果
  function setupFormTransitions() {
    const forms = document.querySelectorAll("form");

    forms.forEach((form) => {
      form.addEventListener("submit", function (e) {
        // 不阻止默認行為，但添加視覺效果
        setTimeout(() => {
          if (document.body) {
            document.body.style.transition = "opacity 0.3s ease-out";
            document.body.style.opacity = "0";
          }
        }, 100);
      });
    });
  }

  // 監聽成功登入/註冊後的跳轉
  function setupSuccessTransition() {
    // 監聽 localStorage 變化（登入成功的標誌）
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
      if (key === "sessionId") {
        // 登入成功，添加過渡動畫
        setTimeout(() => {
          if (document.body) {
            document.body.style.transition = "opacity 0.3s ease-out";
            document.body.style.opacity = "0";
          }
        }, 50);
      }
      originalSetItem.apply(this, arguments);
    };
  }

  // 頁面載入完成後初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setupPageTransitions();
      setupFormTransitions();
      setupSuccessTransition();
    });
  } else {
    setupPageTransitions();
    setupFormTransitions();
    setupSuccessTransition();
  }
})();
