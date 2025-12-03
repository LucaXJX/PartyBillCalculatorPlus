// server/server.ts

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fs from "fs";
import multer from "multer";
import { DataManager } from "./dataManager.js";
import { BillCalculator } from "./billCalculator.js";
import { dataStorage } from "./storage.js";
import { PasswordUtils } from "./passwordUtils.js";
import { messageManager } from "./messageManager.js";
import { MessageHelper } from "./messageHelper.js";
import { overdueReminderService } from "./overdueReminderService.js";
import type { User, BillRecord, Participant } from "./types.js";
import { ocrImage, checkOCRService } from "./ocrClient.js";
import { parseBillFromOCR } from "./llm/billParser.js";
import type { ParsedBill } from "./llm/types.js";
import {
  saveFoodImage,
  getFoodImagesByBillId,
  checkImageLimit,
} from "./foodRecognition/foodImageManager.js";
import { scheduleRecognition, recognizeBillImagesNow } from "./foodRecognition/recognitionScheduler.js";
import { performHealthCheck, fixUnrecognizedImages } from "./foodRecognition/healthCheck.js";
import { checkUsageLimit } from "./foodRecognition/usageTracker.js";

// 解決 ES6 模塊中的 __dirname 問題
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化計算器 (這將在服務器內存中維護狀態)
const calculator = new BillCalculator();

// 配置multer用於文件上傳（存儲在私有目錄）
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadDir = path.join(__dirname, "../data/receipts");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("只允許上傳圖片文件"));
    }
  },
});

// 用戶會話管理器 - 為每個用戶維護獨立的數據管理器
const userDataManagers = new Map<string, DataManager>();

// 獲取用戶的數據管理器
const getUserDataManager = (userId: string): DataManager => {
  if (!userDataManagers.has(userId)) {
    const dataManager = new DataManager(userId);
    userDataManagers.set(userId, dataManager);
  }
  return userDataManagers.get(userId)!;
};

// 中間件：解析JSON請求體
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 中間件：用戶認證
const authenticateUser = async (req: any, res: any, next: any) => {
  const sessionId =
    req.headers.authorization?.replace("Bearer ", "") ||
    req.headers["x-session-id"] ||
    req.cookies?.sessionId;

  if (!sessionId) {
    return res.status(401).json({ error: "未授權訪問" });
  }

  const user = await dataStorage.validateSession(sessionId);
  if (!user) {
    return res.status(401).json({ error: "會話已過期" });
  }

  req.user = user;
  req.userId = user.id;
  req.userDataManager = getUserDataManager(user.id);
  next();
};

// --- API 接口 ---

// === 用戶認證相關 ===

// 用戶註冊
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "請填寫所有必填字段" });
    }

    // 檢查用戶是否已存在
    const existingUser = await dataStorage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "該郵箱已被註冊" });
    }

    const existingUsername = await dataStorage.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: "該用戶名已被使用" });
    }

    // 創建新用戶
    // 加密密碼
    const hashedPassword = PasswordUtils.hashPasswordSync(password);

    const newUser: User = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      username,
      email,
      password: hashedPassword, // bcrypt 加密後的密碼
      createdAt: new Date().toISOString(),
    };

    await dataStorage.saveUser(newUser);

    // 創建會話
    const sessionId = await dataStorage.createSession(newUser.id);

    res.status(201).json({
      message: "註冊成功",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
      sessionId,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "註冊失敗" });
  }
});

// 用戶登入
app.post("/api/auth/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    // 輸入正規化
    if (typeof email === "string") email = email.trim().toLowerCase();
    if (typeof password === "string") password = password.trim();

    if (!email || !password) {
      return res.status(400).json({ error: "請填寫郵箱和密碼" });
    }

    const user = await dataStorage.getUserByEmail(email);
    if (!user || !PasswordUtils.verifyPasswordSync(password, user.password)) {
      return res.status(401).json({ error: "郵箱或密碼錯誤" });
    }

    // 創建會話
    const sessionId = await dataStorage.createSession(user.id);

    res.status(200).json({
      message: "登入成功",
      user: { id: user.id, username: user.username, email: user.email },
      sessionId,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "登入失敗" });
  }
});

// 用戶登出
app.post("/api/auth/logout", async (req, res) => {
  try {
    const sessionId = req.headers.authorization?.replace("Bearer ", "");
    if (sessionId) {
      await dataStorage.destroySession(sessionId);
    }
    res.status(200).json({ message: "登出成功" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "登出失敗" });
  }
});

// 獲取當前用戶信息
app.get("/api/me", authenticateUser, (req: any, res) => {
  res.status(200).json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
    },
  });
});

// 獲取當前用戶信息
app.get("/api/auth/me", authenticateUser, (req: any, res) => {
  res.status(200).json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
    },
  });
});

// === 用戶資料更新 ===
// 更新用戶名
app.put("/api/user/username", authenticateUser, async (req: any, res) => {
  try {
    let { username } = req.body as { username: string };
    if (typeof username !== "string") {
      return res.status(400).json({ message: "用戶名格式不正確" });
    }
    username = username.trim();
    if (username.length < 2 || username.length > 32) {
      return res.status(400).json({ message: "用戶名長度需為2-32字" });
    }

    // 用戶名唯一性
    const existed = await dataStorage.getUserByUsername(username);
    if (existed && existed.id !== req.user.id) {
      return res.status(409).json({ message: "用戶名已被使用" });
    }

    const user: User = { ...req.user, username };
    await dataStorage.saveUser(user);
    return res
      .status(200)
      .json({
        message: "用戶名已更新",
        user: { id: user.id, username: user.username, email: user.email },
      });
  } catch (error) {
    console.error("Update username error:", error);
    return res.status(500).json({ message: "更新失敗" });
  }
});

// 更新郵箱
app.put("/api/user/email", authenticateUser, async (req: any, res) => {
  try {
    let { email } = req.body as { email: string };
    if (typeof email !== "string") {
      return res.status(400).json({ message: "郵箱格式不正確" });
    }
    email = email.trim().toLowerCase();
    const emailRegex = /^\S+@\S+\.[\S]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "請輸入有效的郵箱地址" });
    }

    // 郵箱唯一性
    const existed = await dataStorage.getUserByEmail(email);
    if (existed && existed.id !== req.user.id) {
      return res.status(409).json({ message: "該郵箱已被註冊" });
    }

    const user: User = { ...req.user, email };
    await dataStorage.saveUser(user);
    return res
      .status(200)
      .json({
        message: "郵箱已更新",
        user: { id: user.id, username: user.username, email: user.email },
      });
  } catch (error) {
    console.error("Update email error:", error);
    return res.status(500).json({ message: "郵箱更新失敗" });
  }
});

// 更新密碼
app.put("/api/user/password", authenticateUser, async (req: any, res) => {
  try {
    let { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({ message: "所有欄位皆為必填" });
    }
    currentPassword = currentPassword.trim();
    newPassword = newPassword.trim();
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "新密碼長度需至少6字" });
    }

    const isValid = PasswordUtils.verifyPasswordSync(
      currentPassword,
      req.user.password
    );
    if (!isValid) {
      // 使用 400 表示業務校驗錯誤，避免前端把 401 當成會話失效而自動登出
      return res.status(400).json({ message: "當前密碼不正確" });
    }

    const hashed = PasswordUtils.hashPasswordSync(newPassword);
    const user: User = { ...req.user, password: hashed };
    await dataStorage.saveUser(user);
    return res.status(200).json({ message: "密碼已更新" });
  } catch (error) {
    console.error("Update password error:", error);
    return res.status(500).json({ message: "密碼更新失敗" });
  }
});

// 搜尋用戶
app.get("/api/users/search", authenticateUser, async (req: any, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 1) {
      return res.status(400).json({ error: "搜尋關鍵字不能為空" });
    }

    const users = await dataStorage.searchUsers(query);
    res.status(200).json({ users });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "搜尋用戶失敗" });
  }
});

// === 賬單管理相關 ===

// 1. 重置或創建新賬單
app.post("/api/bill/reset", authenticateUser, (req: any, res) => {
  req.userDataManager.reset();
  res.status(200).json({ message: "新賬單已創建" });
});

// 2. 更新賬單基本信息
app.post("/api/bill/info", authenticateUser, (req: any, res) => {
  const { name, date, location, tipPercentage, payerId } = req.body;
  req.userDataManager.updateBillInfo(
    name,
    date,
    location,
    tipPercentage,
    payerId
  );
  res.status(200).json({ message: "賬單信息已更新" });
});

// 3. 添加參與者
app.post("/api/participant", authenticateUser, (req: any, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "參與者姓名不能为空" });
  }
  const participant = req.userDataManager.addParticipant(name);
  res.status(201).json(participant);
});

// 獲取參與者列表
app.get("/api/participants", authenticateUser, (req: any, res) => {
  const participants = req.userDataManager.getCurrentBill().participants;
  res.status(200).json(participants);
});

// 刪除參與者
app.delete("/api/participant/:id", authenticateUser, (req: any, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "參與者ID不能為空" });
  }

  try {
    req.userDataManager.removeParticipant(id);
    res.status(200).json({ message: "參與者已刪除", participantId: id });
  } catch (error) {
    console.error("刪除參與者失敗:", error);
    res.status(500).json({ error: "刪除參與者失敗" });
  }
});

// 獲取用戶的賬單列表
// 更新支付狀態
app.post(
  "/api/bill/payment-status",
  authenticateUser,
  upload.single("receipt"),
  async (req: any, res) => {
    try {
      const { billId, participantId, paymentStatus } = req.body;

      if (!billId || !participantId || !paymentStatus) {
        return res.status(400).json({ error: "缺少必要參數" });
      }

      // 處理文件上傳（保存相對路徑，不暴露在public目錄）
      let receiptImageUrl = null;
      if (req.file) {
        receiptImageUrl = `/receipts/${req.file.filename}`;
      }

      await dataStorage.updatePaymentStatus(
        billId,
        participantId,
        paymentStatus,
        receiptImageUrl || undefined
      );

      // 如果是提交付款，發送通知給收款人
      if (paymentStatus === "paid") {
        const bill = await dataStorage.getBillById(billId);
        if (bill) {
          await MessageHelper.sendPaymentSubmittedNotification(
            bill,
            participantId,
            receiptImageUrl || undefined
          );
        }
      }

      res.status(200).json({ message: "支付狀態已更新" });
    } catch (error) {
      console.error("更新支付狀態失敗:", error);
      res.status(500).json({ error: "更新支付狀態失敗" });
    }
  }
);

/**
 * 對 LLM 返回的賬單進行 tip 後處理：
 * - 嘗試判斷 tip 是「百分比」還是「金額」
 * - 如果是百分比（0~1 之間的小數），轉換為金額並更新 total
 * - 如果是金額，且除以 subtotal 得到的百分比接近「整數百分比」，則在前端可顯示為百分比（此處暫不改動結構）
 * - 如果是金額但無法得到「好看」的百分比，則將 tip 作為一個獨立的消費項目加入 items，並將 tip 設為 0
 */
function postProcessTip(bill: ParsedBill): ParsedBill {
  const subtotal = bill.subtotal;
  const tip = bill.tip;
  const total = bill.total;

  // 基本檢查（支持負數，代表折扣）
  if (!Number.isFinite(subtotal)) return bill;
  if (!Number.isFinite(tip)) return bill;
  // 允許 subtotal 和 tip 為負數（代表折扣）

  const epsAmount = 0.5; // 金額容忍度

  // 情況 1：tip 在 0~1 之間或 -1~0 之間，視為「百分比（小數）」，如 0.1 表示 10%，-0.1 表示 -10%
  if (tip > 0 && tip < 1) {
    const tipAmount = subtotal * tip;
    const roundedTip = Math.round(tipAmount * 100) / 100;
    const newTotal = Math.round((subtotal + roundedTip) * 100) / 100;

    return {
      ...bill,
      tip: roundedTip,
      total: Number.isFinite(total) ? total : newTotal,
    };
  }

  // 情況 1b：tip 在 -1~0 之間，視為「負百分比（折扣）」，如 -0.1 表示 -10%
  if (tip < 0 && tip > -1) {
    const tipAmount = subtotal * tip;
    const roundedTip = Math.round(tipAmount * 100) / 100;
    const newTotal = Math.round((subtotal + roundedTip) * 100) / 100;

    return {
      ...bill,
      tip: roundedTip,
      total: Number.isFinite(total) ? total : newTotal,
    };
  }

  // 情況 2：tip 看起來是金額（>= 1 或 <= -1）
  // 2.1 嘗試判斷 LLM 是否已將 total 設為 subtotal + tip
  const amountConsistent =
    Number.isFinite(total) && Math.abs(subtotal + tip - total) <= epsAmount;

  // 2.2 從金額反推百分比
  const percentFromAmount = (tip / subtotal) * 100; // 例如 10 表示 10%

  // 判斷是否是「好看」的百分比（接近整數或常見值，包括負數）
  const nicePercents = [-20, -15, -12.5, -10, -8, -5, 5, 8, 10, 12.5, 15, 20];
  const nearestNice = nicePercents.reduce((best, p) =>
    Math.abs(p - percentFromAmount) < Math.abs(best - percentFromAmount)
      ? p
      : best
  , nicePercents[0]);
  const diffNice = Math.abs(nearestNice - percentFromAmount);

  // 若已知是金額，且反推百分比接近一個「好看」的整數（如 5%, 10% 等，包括負數）
  // 這裡不改動結構，只是為前端提供一個穩定的金額；百分比可以在前端按需顯示
  if (diffNice <= 0.25 && amountConsistent && Math.abs(subtotal) > 0.01) {
    // 保留 tip 作為金額，不做結構變更
    // 前端會將 tip 金額轉換為百分比
    return bill;
  }

  // 情況 3：金額除以 subtotal 無法得到好看的百分比
  // 將 tip 作為一個獨立的消費項目加入 items，並將 tip 設為 0
  const tipItemName = tip >= 0 ? "服務費（自動推斷）" : "折扣（自動推斷）";
  const adjustedItems = bill.items.concat([
    {
      name: tipItemName,
      price: tip,
      quantity: 1,
    },
  ]);

  const adjustedSubtotal = subtotal + tip;

  return {
    ...bill,
    items: adjustedItems,
    subtotal: adjustedSubtotal,
    tip: 0,
    // 若原本 total 合理，保留；否則重算
    total: Number.isFinite(total) ? total : adjustedSubtotal,
  };
}

// 上傳收據圖片（付款人上傳付款憑證或其他參與者上傳付款憑證）
app.post(
  "/api/receipt/upload",
  authenticateUser,
  upload.single("receipt"),
  async (req: any, res) => {
    try {
      const { billId, type } = req.body;

      if (!billId || !req.file) {
        return res.status(400).json({ error: "缺少必要參數或文件" });
      }

      const receiptImageUrl = `/receipts/${req.file.filename}`;

      // 根據類型處理不同的邏輯
      if (type === "payer") {
        // 付款人上傳付款憑證
        await dataStorage.updateBillReceipt(billId, receiptImageUrl);
      }

      res.status(200).json({
        message: "收據已上傳",
        receiptUrl: receiptImageUrl,
      });
    } catch (error) {
      console.error("上傳收據失敗:", error);
      res.status(500).json({ error: "上傳收據失敗" });
    }
  }
);

// 獲取 OCR 識別使用量信息
app.get("/api/bill/ocr-usage", authenticateUser, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { checkDailyLimit } = await import("./llm/usageTracker.js");
    const limitCheck = await checkDailyLimit(userId, 10);
    
    res.status(200).json({
      used: limitCheck.used,
      remaining: limitCheck.remaining,
      limit: 10,
      allowed: limitCheck.allowed,
    });
  } catch (error) {
    console.error("獲取使用量信息失敗:", error);
    res.status(500).json({
      error: "獲取使用量信息失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// OCR 賬單識別和解析（上傳圖片，自動識別並解析為結構化數據）
app.post(
  "/api/bill/ocr-upload",
  authenticateUser,
  upload.single("billImage"),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "請上傳圖片文件" });
      }

      const imagePath = req.file.path;
      const userId = req.user.id;

      // 0. 檢查每日使用量限制（僅在成功識別時計數）
      const { checkDailyLimit } = await import("./llm/usageTracker.js");
      const limitCheck = await checkDailyLimit(userId, 10);
      
      // 如果已經超過限制，直接返回錯誤（但允許查看使用量信息）
      if (!limitCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: "今日識別次數已用完（10次/天），請明天再試",
          usage: {
            used: limitCheck.used,
            remaining: 0,
            limit: 10,
            exceeded: true,
          },
        });
      }

      // 返回使用量信息
      const usageInfo = {
        used: limitCheck.used,
        remaining: limitCheck.remaining,
        limit: 10,
      };

      // 1. 檢查 OCR 服務是否可用（本地 FastAPI + PaddleOCR）
      const ocrServiceAvailable = await checkOCRService();
      if (!ocrServiceAvailable) {
        return res.status(503).json({
          error: "OCR 服務暫時不可用，請稍後再試",
        });
      }

      // 2. 調用 OCR 服務識別圖片
      let ocrResult;
      try {
        ocrResult = await ocrImage(imagePath);
      } catch (error) {
        console.error("OCR 識別失敗:", error);
        return res.status(500).json({
          error: "圖片識別失敗，請確保圖片清晰且包含賬單信息",
          details: error instanceof Error ? error.message : String(error),
        });
      }

      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        return res.status(400).json({
          error: "未能從圖片中識別出文字，請確保圖片清晰",
        });
      }

      // 3. 使用 LLM 解析 OCR 文本為結構化數據
      let parsedBill: ParsedBill;
      try {
        parsedBill = await parseBillFromOCR(ocrResult.text, userId);
      } catch (error) {
        console.error("LLM 解析失敗:", error);
        // 即使 LLM 解析失敗，也返回 OCR 文本，讓用戶手動輸入
        // 注意：解析失敗不計入使用量
        return res.status(200).json({
          success: false,
          ocrText: ocrResult.text,
          error: "自動解析失敗，請手動輸入賬單信息",
          details: error instanceof Error ? error.message : String(error),
          usage: usageInfo,
        });
      }

      // 4. 根據 tip 值做後處理（推斷百分比或轉為消費項目）
      const finalBill = postProcessTip(parsedBill);

      // 5. 檢查是否超過限制（成功識別後，重新獲取最新使用量）
      const finalLimitCheck = await checkDailyLimit(userId, 10);
      
      // 6. 返回解析結果（包含使用量信息）
      // 注意：即使超過限制，也允許本次識別（因為已經成功），但會提示用戶
      res.status(200).json({
        success: true,
        ocrText: ocrResult.text,
        bill: finalBill,
        message: finalLimitCheck.allowed
          ? "賬單識別成功"
          : "賬單識別成功，但今日次數已用完，下次請明天再試",
        usage: {
          used: finalLimitCheck.used,
          remaining: finalLimitCheck.remaining,
          limit: 10,
          exceeded: !finalLimitCheck.allowed,
        },
      });
    } catch (error) {
      console.error("OCR 上傳處理失敗:", error);
      res.status(500).json({
        error: "處理失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 確認收款（付款人確認收到其他人的付款）
app.post(
  "/api/bill/confirm-payment",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { billId, participantId, confirmed } = req.body;

      if (!billId || !participantId || confirmed === undefined) {
        return res.status(400).json({ error: "缺少必要參數" });
      }

      // 更新收款確認狀態
      await dataStorage.confirmPayment(billId, participantId, confirmed);

      // 如果確認收款，發送通知給付款人
      if (confirmed) {
        const bill = await dataStorage.getBillById(billId);
        if (bill) {
          await MessageHelper.sendPaymentConfirmedNotification(
            bill,
            participantId
          );
        }
      }

      console.log(
        `用戶 ${req.userId} 確認${
          confirmed ? "收到" : "未收到"
        } 參與者 ${participantId} 的付款`
      );

      res.status(200).json({ message: "收款確認已更新" });
    } catch (error) {
      console.error("確認收款失敗:", error);
      res.status(500).json({ error: "確認收款失敗" });
    }
  }
);

// 拒絕收款（付款人標記問題並退回待支付）
app.post(
  "/api/bill/reject-payment",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { billId, participantId, reason, rejectedAt } = req.body;

      if (!billId || !participantId || !reason) {
        return res.status(400).json({ error: "缺少必要參數" });
      }

      // 驗證拒絕原因
      const validReasons = ["not_received", "wrong_receipt"];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ error: "無效的拒絕原因" });
      }

      // 拒絕收款並退回待支付狀態
      await dataStorage.rejectPayment(
        billId,
        participantId,
        reason,
        rejectedAt
      );

      // 發送拒絕通知給付款人
      const bill = await dataStorage.getBillById(billId);
      if (bill) {
        await MessageHelper.sendPaymentRejectedNotification(
          bill,
          participantId,
          reason
        );
      }

      const reasonText = reason === "not_received" ? "未收到款項" : "收據有誤";
      console.log(
        `用戶 ${req.userId} 拒絕參與者 ${participantId} 的付款（原因: ${reasonText}）`
      );

      res.status(200).json({ message: "已標記問題並退回待支付狀態" });
    } catch (error) {
      console.error("拒絕收款失敗:", error);
      res.status(500).json({ error: "拒絕收款失敗" });
    }
  }
);

// 4. 添加消費項目
app.post("/api/item", authenticateUser, (req: any, res) => {
  const { name, amount, isShared, participantIds } = req.body;
  if (!name || !amount) {
    return res.status(400).json({ error: "項目名稱和金額不能為空" });
  }

  let finalParticipantIds = participantIds || [];

  // 如果是共享項目且沒有指定參與者，自動包含所有參與者
  if (isShared && finalParticipantIds.length === 0) {
    const currentBill = req.userDataManager.getCurrentBill();
    finalParticipantIds = currentBill.participants.map((p: any) => p.id);
  }

  if (finalParticipantIds.length === 0) {
    return res.status(400).json({ error: "項目必須至少包含一個參與者" });
  }

  const item = req.userDataManager.addItem(
    name,
    amount,
    isShared,
    finalParticipantIds
  );
  res.status(201).json(item);
});

// 5. 計算賬單
app.get("/api/calculate", authenticateUser, (req: any, res) => {
  const bill = req.userDataManager.getCurrentBill();
  const results = calculator.calculate(bill);
  res.status(200).json({
    bill,
    results,
  });
});

// === 數據存儲相關 ===

// 保存賬單到數據庫
app.post("/api/bill/save", authenticateUser, async (req: any, res) => {
  try {
    const bill = req.userDataManager.getCurrentBill();
    const results = calculator.calculate(bill);

    // 驗證必須有付款人
    if (!bill.payerId || bill.payerId.trim() === "") {
      return res.status(400).json({ error: "請選擇付款人" });
    }

    // 驗證付款人必須在參與者列表中
    const payerExists = bill.participants.some(
      (p: Participant) => p.id === bill.payerId
    );
    if (!payerExists) {
      return res.status(400).json({ error: "付款人必須是參與者之一" });
    }

    // 驗證付款人不能是空的參與者
    const payer = bill.participants.find(
      (p: Participant) => p.id === bill.payerId
    );
    if (!payer || !payer.name || payer.name.trim() === "") {
      return res.status(400).json({ error: "付款人信息無效" });
    }

    // 自動將付款人的狀態設置為已付款
    const payerResult = results.find((r) => r.participantId === bill.payerId);
    if (payerResult) {
      payerResult.paymentStatus = "paid";
      payerResult.paidAt = new Date().toISOString();
    }

    const billRecord: BillRecord = {
      ...bill,
      results,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.id,
    };

    await dataStorage.saveBill(billRecord);

    // 發送新建賬單通知給所有參與者
    await MessageHelper.sendNewBillNotifications(billRecord);

    // 調度食物圖片識別任務（1 分鐘後執行）
    // 只有在訂單有食物圖片時才調度
    if (billRecord.id) {
      const images = await getFoodImagesByBillId(billRecord.id);
      if (images.length > 0) {
        scheduleRecognition(billRecord.id);
      }
    }

    res.status(200).json({
      message: "賬單已保存",
      billId: billRecord.id,
    });
  } catch (error) {
    console.error("Save bill error:", error);
    res.status(500).json({ error: "保存賬單失敗" });
  }
});

// === 消息相關 API ===

// 獲取用戶的所有消息
app.get("/api/messages", authenticateUser, async (req: any, res) => {
  try {
    const messages = await messageManager.getUserMessages(req.user.id);
    res.status(200).json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "獲取消息失敗" });
  }
});

// 獲取未讀消息數量
app.get(
  "/api/messages/unread-count",
  authenticateUser,
  async (req: any, res) => {
    try {
      const count = await messageManager.getUnreadCount(req.user.id);
      res.status(200).json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "獲取未讀數量失敗" });
    }
  }
);

// 標記消息為已讀
app.post("/api/messages/mark-read", authenticateUser, async (req: any, res) => {
  try {
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: "缺少消息 ID" });
    }

    const success = await messageManager.markAsRead(messageId);

    if (success) {
      res.status(200).json({ message: "已標記為已讀" });
    } else {
      res.status(404).json({ error: "消息不存在" });
    }
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ error: "標記已讀失敗" });
  }
});

// 標記所有消息為已讀
app.post(
  "/api/messages/mark-all-read",
  authenticateUser,
  async (req: any, res) => {
    try {
      const count = await messageManager.markAllAsRead(req.user.id);
      res.status(200).json({ message: `已標記 ${count} 條消息為已讀`, count });
    } catch (error) {
      console.error("Mark all read error:", error);
      res.status(500).json({ error: "標記所有已讀失敗" });
    }
  }
);

// 刪除消息
app.delete("/api/messages/:id", authenticateUser, async (req: any, res) => {
  try {
    const success = await messageManager.deleteMessage(req.params.id);

    if (success) {
      res.status(200).json({ message: "消息已刪除" });
    } else {
      res.status(404).json({ error: "消息不存在" });
    }
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ error: "刪除消息失敗" });
  }
});

// 從消息中確認收款
app.post(
  "/api/messages/confirm-payment",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { messageId, billId, participantId } = req.body;

      if (!messageId || !billId || !participantId) {
        return res.status(400).json({ error: "缺少必要參數" });
      }

      // 確認收款
      await dataStorage.confirmPayment(billId, participantId, true);

      // 標記消息操作已完成
      await messageManager.markActionCompleted(messageId);

      // 發送確認通知給付款人
      const bill = await dataStorage.getBillById(billId);
      if (bill) {
        await MessageHelper.sendPaymentConfirmedNotification(
          bill,
          participantId
        );
      }

      console.log(
        `用戶 ${req.user.id} 通過消息確認收到 參與者 ${participantId} 的付款`
      );

      res.status(200).json({ message: "收款已確認" });
    } catch (error) {
      console.error("確認收款失敗:", error);
      res.status(500).json({ error: "確認收款失敗" });
    }
  }
);

// 從消息中拒絕收款
app.post(
  "/api/messages/reject-payment",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { messageId, billId, participantId, reason } = req.body;

      if (!messageId || !billId || !participantId || !reason) {
        return res.status(400).json({ error: "缺少必要參數" });
      }

      // 驗證拒絕原因
      const validReasons = ["not_received", "wrong_receipt"];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ error: "無效的拒絕原因" });
      }

      // 拒絕收款
      await dataStorage.rejectPayment(
        billId,
        participantId,
        reason,
        new Date().toISOString()
      );

      // 標記消息操作已完成
      await messageManager.markActionCompleted(messageId);

      // 發送拒絕通知給付款人
      const bill = await dataStorage.getBillById(billId);
      if (bill) {
        await MessageHelper.sendPaymentRejectedNotification(
          bill,
          participantId,
          reason
        );
      }

      const reasonText = reason === "not_received" ? "未收到款項" : "收據有誤";
      console.log(
        `用戶 ${req.user.id} 通過消息拒絕參與者 ${participantId} 的付款（原因: ${reasonText}）`
      );

      res.status(200).json({ message: "已標記問題並退回待支付狀態" });
    } catch (error) {
      console.error("拒絕收款失敗:", error);
      res.status(500).json({ error: "拒絕收款失敗" });
    }
  }
);

// === 賬單相關 API ===

// 獲取用戶的所有賬單
app.get("/api/bills", authenticateUser, async (req: any, res) => {
  try {
    const bills = await dataStorage.getBillsByUser(req.user.id);
    res.status(200).json({ bills });
  } catch (error) {
    console.error("Get bills error:", error);
    res.status(500).json({ error: "獲取賬單失敗" });
  }
});

// 獲取特定賬單
app.get("/api/bill/:id", authenticateUser, async (req: any, res) => {
  try {
    const bill = await dataStorage.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: "賬單不存在" });
    }

    if (bill.createdBy !== req.user.id) {
      return res.status(403).json({ error: "無權限訪問此賬單" });
    }

    res.status(200).json({ bill });
  } catch (error) {
    console.error("Get bill error:", error);
    res.status(500).json({ error: "獲取賬單失敗" });
  }
});

// 刪除賬單
app.delete("/api/bill/:id", authenticateUser, async (req: any, res) => {
  try {
    const bill = await dataStorage.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: "賬單不存在" });
    }

    if (bill.createdBy !== req.user.id) {
      return res.status(403).json({ error: "無權限刪除此賬單" });
    }

    const deleted = await dataStorage.deleteBill(req.params.id);
    if (deleted) {
      res.status(200).json({ message: "賬單已刪除" });
    } else {
      res.status(500).json({ error: "刪除賬單失敗" });
    }
  } catch (error) {
    console.error("Delete bill error:", error);
    res.status(500).json({ error: "刪除賬單失敗" });
  }
});

// --- 靜態文件服務和SPA路由支持 ---

// 頁面保護中間件
const protectPage = (pageType: "public" | "protected" | "auth") => {
  return async (req: any, res: any, next: any) => {
    const sessionId =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.sessionId;
    const user = sessionId
      ? await dataStorage.validateSession(sessionId)
      : null;
    const isAuthenticated = !!user;

    // 將認證信息附加到請求對象
    req.user = user;
    req.isAuthenticated = isAuthenticated;

    switch (pageType) {
      case "public":
        // 公開頁面，不需要認證
        break;
      case "protected":
        // 受保護頁面，需要認證
        if (!isAuthenticated) {
          // 如果是API請求，返回401
          if (req.path.startsWith("/api/")) {
            return res.status(401).json({ error: "需要登入" });
          }
          // 如果是頁面請求，重定向到登入頁面
          return res.redirect("/login-page.html");
        }
        break;
      case "auth":
        // 認證頁面，如果已登入則重定向到計算器
        if (isAuthenticated) {
          return res.redirect("/calculator.html");
        }
        break;
    }

    next();
  };
};

// 受保護的收據圖片訪問路由（需要認證）
app.get("/receipts/:filename", authenticateUser, (req: any, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../data/receipts", filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "文件不存在" });
  }

  res.sendFile(filePath);
});

// 獲取食物圖片
app.get("/food_images/:filename", authenticateUser, (req: any, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../data/food_images", filename);

  // 檢查文件是否存在
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "圖片不存在" });
  }
});

// 設置靜態文件目錄，只暴露 public 目錄
app.use(express.static(path.join(__dirname, "../public")));

// 受保護的頁面路由
app.get("/calculator.html", protectPage("protected"), (req, res) => {
  res.sendFile(path.join(__dirname, "../public/calculator.html"));
});

// 認證頁面路由
app.get("/login-page.html", protectPage("auth"), (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login-page.html"));
});

app.get("/registration-page.html", protectPage("auth"), (req, res) => {
  res.sendFile(path.join(__dirname, "../public/registration-page.html"));
});

// 處理所有其他路由，返回 index.html 支持 SPA
// 但排除 API 路由
// 管理端點：手動觸發逾期檢查（僅用於測試）
app.post(
  "/api/admin/trigger-overdue-check",
  authenticateUser,
  async (req: any, res) => {
    try {
      console.log("🧪 手動觸發逾期檢查（測試用）");
      const count = await overdueReminderService.triggerCheck();
      res.json({
        success: true,
        count: count,
        message: "逾期檢查已完成",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("手動觸發逾期檢查失敗:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.use((req, res, next) => {
  // 如果是 API 路由，跳過 SPA 處理
  if (req.path.startsWith("/api/")) {
    return next();
  }

  const indexPath = path.join(__dirname, "../public/index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Not Found");
  }
});

// 啟動服務器
app.listen(PORT, () => {
  console.log(`服務器運行在 http://localhost:${PORT}`);
  console.log(`- 靜態資源來源: public 文件夾`);
  console.log(`- API 根路徑: /api`);

  // 啟動逾期賬單提醒服務
  overdueReminderService.start();
  console.log(`- 逾期提醒服務: 已啟動（每天晚上 8 點檢查）`);
});

// === 食物圖片相關 API ===

// 上傳食物圖片
app.post(
  "/api/food/upload",
  authenticateUser,
  upload.single("foodImage"),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "請選擇圖片文件" });
      }

      const { billId } = req.body;

      if (!billId) {
        // 刪除已上傳的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "缺少訂單 ID" });
      }

      // 檢查圖片上傳限制（每訂單最多 2 張）
      const limitCheck = await checkImageLimit(billId, 2);
      if (!limitCheck.allowed) {
        // 刪除已上傳的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: `已達到上傳限制（每訂單最多 2 張）`,
          current: limitCheck.current,
        });
      }

      // 保存食物圖片
      const imageRecord = await saveFoodImage(
        req.file.path,
        billId,
        req.userId,
        req.file.originalname
      );

      // 調度識別任務（10 秒後執行，暫時改為 10 秒方便測試）
      // 每次上傳完成後都調度，如果已有任務會自動取消舊任務
      scheduleRecognition(billId);
      const allImages = await getFoodImagesByBillId(billId);
      console.log(`已為訂單 ${billId} 調度識別任務（圖片上傳完成，共 ${allImages.length} 張，10 秒後執行）`);

      res.status(200).json({
        message: "圖片上傳成功",
        image: {
          id: imageRecord.id,
          filename: imageRecord.originalFilename,
          storedPath: imageRecord.storedPath,
          recognitionStatus: imageRecord.recognitionStatus,
        },
        limit: {
          current: limitCheck.current + 1,
          remaining: limitCheck.remaining - 1,
        },
      });
    } catch (error) {
      console.error("上傳食物圖片失敗:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        error: "上傳食物圖片失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 獲取訂單的食物圖片列表
app.get("/api/food/images/:billId", authenticateUser, async (req: any, res) => {
  try {
    const { billId } = req.params;
    const images = await getFoodImagesByBillId(billId);

    res.status(200).json({
      images: images.map((img) => ({
        id: img.id,
        filename: img.originalFilename,
        storedPath: img.storedPath,
        fileSize: img.fileSize,
        width: img.width,
        height: img.height,
        recognitionStatus: img.recognitionStatus,
        recognitionResult: img.recognitionResult
          ? JSON.parse(img.recognitionResult)
          : null,
        recognitionError: img.recognitionError,
        recognitionAt: img.recognitionAt,
        createdAt: img.createdAt,
      })),
    });
  } catch (error) {
    console.error("獲取食物圖片列表失敗:", error);
    res.status(500).json({ error: "獲取食物圖片列表失敗" });
  }
});

// 手動觸發識別
app.post("/api/food/recognize/:billId", authenticateUser, async (req: any, res) => {
  try {
    const { billId } = req.params;

    // 檢查 API 使用限制
    const usageCheck = await checkUsageLimit(1000);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: `已超過 API 使用限制（${usageCheck.used}/1000）`,
        usage: usageCheck,
      });
    }

    await recognizeBillImagesNow(billId);

    res.status(200).json({
      message: "識別任務已觸發",
      usage: usageCheck,
    });
  } catch (error) {
    console.error("觸發識別失敗:", error);
    res.status(500).json({
      error: "觸發識別失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 健康檢查（自檢機制）
app.get("/api/food/health", authenticateUser, async (req: any, res) => {
  try {
    const health = await performHealthCheck();
    res.status(200).json(health);
  } catch (error) {
    console.error("健康檢查失敗:", error);
    res.status(500).json({ error: "健康檢查失敗" });
  }
});

// 修復未識別的圖片
app.post("/api/food/fix-unrecognized", authenticateUser, async (req: any, res) => {
  try {
    // 檢查 API 使用限制
    const usageCheck = await checkUsageLimit(1000);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: `已超過 API 使用限制（${usageCheck.used}/1000）`,
        usage: usageCheck,
      });
    }

    const result = await fixUnrecognizedImages();

    res.status(200).json({
      message: "修復完成",
      result,
      usage: usageCheck,
    });
  } catch (error) {
    console.error("修復未識別圖片失敗:", error);
    res.status(500).json({ error: "修復失敗" });
  }
});

// 獲取 API 使用量
app.get("/api/food/usage", authenticateUser, async (req: any, res) => {
  try {
    const usage = await checkUsageLimit(1000);
    res.status(200).json(usage);
  } catch (error) {
    console.error("獲取 API 使用量失敗:", error);
    res.status(500).json({ error: "獲取 API 使用量失敗" });
  }
});
