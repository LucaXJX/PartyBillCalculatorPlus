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
  getFoodImageById,
  checkImageLimit,
  setRecognitionPipeline,
} from "./foodRecognition/foodImageManager.js";
import {
  getRecommendedFoods,
  getDiverseRecommendations,
  formatRecommendations,
} from "./foodRecognition/foodRecommendationService.js";
import {
  scheduleRecognition,
  recognizeBillImagesNow,
} from "./foodRecognition/recognitionScheduler.js";
import {
  performHealthCheck,
  fixUnrecognizedImages,
} from "./foodRecognition/healthCheck.js";
import { checkUsageLimit } from "./foodRecognition/usageTracker.js";
import { proxy } from "./proxy.js";
import { db } from "./db.js";
import type {
  Bill as DBBill,
  BillParticipant,
  Item as DBItem,
  ItemParticipant,
  CalculationResult as DBCalculationResult,
} from "./proxy.js";
import {
  recommendRestaurants,
  extractUserPreferences,
  type RecommendationOptions,
} from "./restaurantRecommender.js";
// 延遲加載 TensorFlow.js 相關模塊（避免構建失敗時服務器無法啟動）
// 優先嘗試使用純 JavaScript 版本（@tensorflow/tfjs），不需要構建 native 模塊
let ModelLoader: any;
let ImagePreprocessor: any;
let RecognitionPipeline: any;
let ModelVersionManager: any;
let modelLoader: any;
let imagePreprocessor: any;
let recognitionPipeline: any;
let modelVersionManager: any;
let tensorflowAvailable = false;

// 嘗試加載 TensorFlow.js 模塊
async function loadTensorFlowModules() {
  try {
    // 只使用純 JavaScript 版本（不需要構建 native 模塊）
    // 這樣可以避免 Windows 上的構建問題
    let tfjsModule;
    try {
      tfjsModule = await import("@tensorflow/tfjs");
      console.log("✅ 使用純 JavaScript 版本的 TensorFlow.js（不需要構建）");
    } catch (e) {
      console.error("❌ 無法加載 TensorFlow.js:", e);
      throw new Error("TensorFlow.js 加載失敗");
    }

    const modules = await import("./food-recognition/models/index.js");
    ModelLoader = modules.ModelLoader;
    ImagePreprocessor = modules.ImagePreprocessor;
    RecognitionPipeline = modules.RecognitionPipeline;
    ModelVersionManager = modules.ModelVersionManager;

    // 初始化 TensorFlow.js 食物識別系統
    // 使用轉換後的模型路徑（從 Python 訓練服務轉換）
    // 修復路徑：__dirname 指向 server 目錄，所以只需要上一級就是項目根目錄
    const projectRoot = path.resolve(__dirname, "..");
    const modelsPath = path.join(
      projectRoot,
      "food-recognition-service/models_tfjs"
    );
    modelLoader = new ModelLoader(modelsPath);
    imagePreprocessor = new ImagePreprocessor();
    recognitionPipeline = new RecognitionPipeline(
      modelLoader,
      imagePreprocessor
    );

    // 設置模型識別管道到 foodImageManager（用於雙重識別）
    setRecognitionPipeline(recognitionPipeline);

    // 初始化模型版本管理器
    modelVersionManager = new ModelVersionManager();

    tensorflowAvailable = true;
    console.log("✅ TensorFlow.js 模塊加載成功");
    console.log("   模型路徑: " + modelsPath);
    console.log("   提示: 如果模型不存在，請先運行 Python 訓練腳本並轉換模型");
    return true;
  } catch (error) {
    console.warn("⚠️  TensorFlow.js 模塊加載失敗:");
    console.warn(
      "   錯誤:",
      error instanceof Error ? error.message : String(error)
    );
    console.warn("   服務器將正常啟動，但食物識別功能將不可用");
    console.warn("   要啟用食物識別，請:");
    console.warn(
      "   1. 運行 Python 訓練腳本: cd food-recognition-service && python train/train_level1.py"
    );
    console.warn("   2. 轉換模型: python convert/convert_to_tfjs.py");
    console.warn("   3. 重啟服務器");
    tensorflowAvailable = false;
    return false;
  }
}

// 解決 ES6 模塊中的 __dirname 問題
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化計算器 (這將在服務器內存中維護狀態)
const calculator = new BillCalculator();

// 異步初始化模型（從數據庫加載活動版本）
async function initializeFoodRecognitionModels() {
  if (!tensorflowAvailable) {
    console.log("⏭️  跳過模型初始化（TensorFlow.js 不可用）");
    return;
  }

  try {
    if (!modelLoader || !modelVersionManager) {
      console.warn("⚠️  模型加載器或版本管理器未初始化，跳過模型加載");
      return;
    }

    // 加載第一層模型（從數據庫獲取活動版本）
    const level1Version = await modelVersionManager.getActiveVersion(1);
    if (level1Version) {
      await modelLoader.loadLevel1Model(level1Version.model_path);
      console.log(
        `✅ 已加載第一層模型: ${level1Version.version} (${level1Version.model_path})`
      );
    } else {
      // 如果沒有活動版本，嘗試使用默認路徑
      const projectRoot = path.resolve(__dirname, "..");
      const defaultPath = path.join(
        projectRoot,
        "food-recognition-service/models_tfjs/level1"
      );
      try {
        await modelLoader.loadLevel1Model(defaultPath);
        console.log("✅ 已加載第一層模型（默認路徑）");
      } catch (error) {
        console.warn(
          "⚠️  第一層模型加載失敗（使用默認路徑）:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // 加載第二層模型
    const level2Version = await modelVersionManager.getActiveVersion(2);
    if (level2Version) {
      await modelLoader.loadLevel2Model(level2Version.model_path);
      console.log(
        `✅ 已加載第二層模型: ${level2Version.version} (${level2Version.model_path})`
      );
    } else {
      const projectRoot = path.resolve(__dirname, "..");
      const defaultPath = path.join(
        projectRoot,
        "food-recognition-service/models_tfjs/level2"
      );
      try {
        await modelLoader.loadLevel2Model(defaultPath);
        console.log("✅ 已加載第二層模型（默認路徑）");
      } catch (error) {
        console.warn(
          "⚠️  第二層模型加載失敗（使用默認路徑）:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // 第三層模型暫時隱藏（已註釋，保留代碼以便將來恢復）
    console.log("✅ 模型初始化完成（目前使用兩層識別：食物檢測 + 國家分類）");
  } catch (error) {
    console.error("❌ 模型初始化失敗:", error);
  }
}

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
    fileSize: 20 * 1024 * 1024, // 20MB限制（增加以支持高分辨率圖片）
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
    return res.status(200).json({
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
    return res.status(200).json({
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
  const nearestNice = nicePercents.reduce(
    (best, p) =>
      Math.abs(p - percentFromAmount) < Math.abs(best - percentFromAmount)
        ? p
        : best,
    nicePercents[0]
  );
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

// 生成唯一 ID 的工具函數
function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * 將 BillRecord 同步到數據庫（用於消息系統的外鍵引用）
 */
async function syncBillToDatabase(billRecord: BillRecord): Promise<void> {
  try {
    const billId = billRecord.id;
    if (!billId) {
      throw new Error("Bill ID is required");
    }

    // 驗證必要的字段
    if (!billRecord.participants || !Array.isArray(billRecord.participants)) {
      console.warn("⚠️  賬單缺少參與者信息，跳過數據庫同步");
      return;
    }

    if (!billRecord.items || !Array.isArray(billRecord.items)) {
      console.warn("⚠️  賬單缺少項目信息，跳過數據庫同步");
      return;
    }

    if (!billRecord.results || !Array.isArray(billRecord.results)) {
      console.warn("⚠️  賬單缺少計算結果，跳過數據庫同步");
      return;
    }

    // 檢查賬單是否已存在於數據庫
    // 確保 proxy.bill 存在且是數組
    if (!proxy.bill || !Array.isArray(proxy.bill)) {
      console.warn("⚠️  proxy.bill 不存在或不是數組，跳過數據庫同步");
      return;
    }
    // 過濾掉 null/undefined 元素
    const validBills = proxy.bill.filter((b: any) => b != null);
    const existingBill = validBills.find((b: any) => b && b.id === billId);
    
    // 獲取參與者對應的用戶 ID（通過用戶名查找）
    const participantUserIds: Map<string, string> = new Map();
    for (const participant of billRecord.participants) {
      if (!participant || !participant.name) {
        console.warn(`⚠️  跳過無效的參與者: ${JSON.stringify(participant)}`);
        continue;
      }
      const user = await dataStorage.getUserByUsername(participant.name);
      if (user) {
        participantUserIds.set(participant.id, user.id);
      }
    }

    // 獲取付款人的用戶 ID
    const payerParticipant = billRecord.participants.find(
      (p) => p && p.id === billRecord.payerId
    );
    const payerUserId = payerParticipant
      ? participantUserIds.get(billRecord.payerId) || billRecord.payerId
      : billRecord.payerId;

    // 轉換為數據庫格式的 Bill
    const dbBill: DBBill = {
      id: billId,
      name: billRecord.name,
      date: billRecord.date,
      location: billRecord.location || null,
      tip_percentage: billRecord.tipPercentage,
      payer_id: payerUserId,
      created_by: billRecord.createdBy,
      payer_receipt_url: billRecord.payerReceiptUrl || null,
      created_at: billRecord.createdAt,
      updated_at: billRecord.updatedAt,
    };

    if (existingBill) {
      // 更新現有賬單
      Object.assign(existingBill, dbBill);
    } else {
      // 創建新賬單
      proxy.bill.push(dbBill);
    }

    // 同步參與者
    // 先刪除舊的參與者記錄（如果存在）
    // 確保 proxy.bill_participant 存在且是數組
    if (proxy.bill_participant && Array.isArray(proxy.bill_participant)) {
      const validParticipants = proxy.bill_participant.filter((bp: any) => bp != null);
      const existingParticipants = validParticipants.filter(
        (bp: any) => bp && bp.bill_id === billId
      );
      for (const ep of existingParticipants) {
        const index = proxy.bill_participant.indexOf(ep);
        if (index !== -1) {
          proxy.bill_participant.splice(index, 1);
        }
      }
    }

    // 添加新的參與者記錄
    for (const participant of billRecord.participants) {
      if (!participant || !participant.id || !participant.name) {
        console.warn(`⚠️  跳過無效的參與者: ${JSON.stringify(participant)}`);
        continue;
      }
      const userId = participantUserIds.get(participant.id) || participant.id;
      const dbParticipant: BillParticipant = {
        id: generateId(),
        bill_id: billId,
        participant_id: userId,
        participant_name: participant.name,
        created_at: billRecord.createdAt,
      };
      // 確保 proxy.bill_participant 存在且是數組
      if (proxy.bill_participant && Array.isArray(proxy.bill_participant)) {
        proxy.bill_participant.push(dbParticipant);
      } else {
        console.warn("⚠️  proxy.bill_participant 不存在或不是數組，跳過參與者同步");
      }
    }

    // 同步項目
    // 先刪除舊的項目記錄（如果存在）
    // 確保 proxy.item 存在且是數組
    if (!proxy.item || !Array.isArray(proxy.item)) {
      console.warn("⚠️  proxy.item 不存在或不是數組，跳過項目同步");
    } else {
      const validItems = proxy.item.filter((item: any) => item != null);
      const existingItems = validItems.filter((item: any) => item && item.bill_id === billId);
      for (const item of existingItems) {
        const index = proxy.item.indexOf(item);
        if (index !== -1) {
          proxy.item.splice(index, 1);
        }
        // 同時刪除相關的 item_participant 記錄
        if (proxy.item_participant && Array.isArray(proxy.item_participant)) {
          const validItemParticipants = proxy.item_participant.filter((ip: any) => ip != null);
          const itemParticipants = validItemParticipants.filter(
            (ip: any) => ip && ip.item_id === item.id
          );
          for (const ip of itemParticipants) {
            const ipIndex = proxy.item_participant.indexOf(ip);
            if (ipIndex !== -1) {
              proxy.item_participant.splice(ipIndex, 1);
            }
          }
        }
      }
    }

    // 添加新的項目記錄
    if (proxy.item && Array.isArray(proxy.item)) {
      for (const item of billRecord.items) {
        if (!item || !item.id || !item.name) {
          console.warn(`⚠️  跳過無效的項目: ${JSON.stringify(item)}`);
          continue;
        }
        const dbItem: DBItem = {
          id: item.id,
          bill_id: billId,
          name: item.name,
          amount: item.amount,
          is_shared: item.isShared ? 1 : 0,
          created_at: billRecord.createdAt,
        };
        proxy.item.push(dbItem);

        // 添加項目參與者
        if (item.participantIds && Array.isArray(item.participantIds)) {
          if (proxy.item_participant && Array.isArray(proxy.item_participant)) {
            for (const participantId of item.participantIds) {
              const userId = participantUserIds.get(participantId) || participantId;
              const dbItemParticipant: ItemParticipant = {
                id: generateId(),
                item_id: item.id,
                participant_id: userId,
                created_at: billRecord.createdAt,
              };
              proxy.item_participant.push(dbItemParticipant);
            }
          }
        }
      }
    } else {
      console.warn("⚠️  proxy.item 不存在或不是數組，跳過項目添加");
    }

    // 同步計算結果
    // 先刪除舊的計算結果記錄（如果存在）
    if (!proxy.calculation_result || !Array.isArray(proxy.calculation_result)) {
      console.warn("⚠️  proxy.calculation_result 不存在或不是數組，跳過計算結果同步");
    } else {
      const validResults = proxy.calculation_result.filter((cr: any) => cr != null);
      const existingResults = validResults.filter(
        (cr: any) => cr && cr.bill_id === billId
      );
      for (const result of existingResults) {
        const index = proxy.calculation_result.indexOf(result);
        if (index !== -1) {
          proxy.calculation_result.splice(index, 1);
        }
      }

      // 添加新的計算結果記錄
      for (const result of billRecord.results) {
        if (!result || !result.participantId) {
          console.warn(`⚠️  跳過無效的計算結果: ${JSON.stringify(result)}`);
          continue;
        }
        const userId = participantUserIds.get(result.participantId) || result.participantId;
        const dbResult: DBCalculationResult = {
          id: generateId(),
          bill_id: billId,
          participant_id: userId,
          amount: result.amount,
          breakdown: result.breakdown || null,
          payment_status: result.paymentStatus || "pending",
          paid_at: result.paidAt || null,
          confirmed_by_payer: result.confirmedByPayer ? 1 : 0,
          receipt_image_url: result.receiptImageUrl || null,
          rejected_reason: result.rejectedReason || null,
          rejected_at: result.rejectedAt || null,
          created_at: billRecord.createdAt,
          updated_at: billRecord.updatedAt,
        };
        proxy.calculation_result.push(dbResult);
      }
    }

    console.log(`✅ 賬單 ${billId} 已同步到數據庫`);
  } catch (error) {
    console.error("同步賬單到數據庫失敗:", error);
    // 不拋出錯誤，因為 JSON 文件已經保存成功
    // 消息系統會使用 dataStorage 驗證，所以即使數據庫同步失敗，消息也能正常工作
  }
}

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

    // 如果 bill 沒有 id，生成一個新的 id（新建賬單）
    const billId = bill.id || generateId();
    
    const billRecord: BillRecord = {
      ...bill,
      id: billId,
      results,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.id,
    };

    await dataStorage.saveBill(billRecord);

    // 同步賬單到數據庫（用於消息系統的外鍵引用）
    // 如果同步失敗，跳過消息發送（避免外鍵約束錯誤）
    let dbSyncSuccess = false;
    try {
      await syncBillToDatabase(billRecord);
      dbSyncSuccess = true;
    } catch (error) {
      console.error("同步賬單到數據庫失敗:", error);
      // 不拋出錯誤，因為 JSON 文件已經保存成功
    }

    // 只有在數據庫同步成功後才發送消息（避免外鍵約束錯誤）
    if (dbSyncSuccess) {
      try {
        await MessageHelper.sendNewBillNotifications(billRecord);
      } catch (error) {
        console.error("發送消息失敗:", error);
        // 不影響賬單保存的成功響應
      }
    } else {
      console.warn("⚠️  跳過消息發送（數據庫同步失敗）");
    }

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
// === 消息相關 API ===
// 注意：具體路由必須在通用路由之前註冊

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

// 重複的路由定義已移除（已在第 1363 行定義）

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
      res.status(500).json({ error: "標記已讀失敗" });
    }
  }
);

// 確認收款
app.post(
  "/api/messages/confirm-payment",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { messageId, billId, participantId } = req.body;

      if (!messageId || !billId || !participantId) {
        return res.status(400).json({ error: "缺少必要參數" });
      }

      // 檢查消息是否已經被標記為已完成
      const message = await messageManager.getUserMessages(req.user.id).then(
        (messages) => messages.find((m) => m.id === messageId)
      );
      
      if (message && message.actionCompleted) {
        console.warn(`⚠️  消息 ${messageId} 已經被確認過，跳過重複操作`);
        return res.status(200).json({ message: "收款已確認（重複操作）" });
      }

      // 確認收款
      await dataStorage.confirmPayment(billId, participantId, true);

      // 標記消息操作已完成
      const marked = await messageManager.markActionCompleted(messageId);
      if (!marked) {
        console.warn(`⚠️  無法標記消息 ${messageId} 為已完成`);
      }

      // 發送確認通知給付款人（只有在第一次確認時才發送）
      if (marked) {
        const bill = await dataStorage.getBillById(billId);
        if (bill) {
          await MessageHelper.sendPaymentConfirmedNotification(
            bill,
            participantId
          );
        }
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

// 拒絕收款
app.post(
  "/api/messages/reject-payment",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { messageId, billId, participantId } = req.body;

      if (!messageId || !billId || !participantId) {
        return res.status(400).json({ error: "缺少必要參數" });
      }

      // 標記支付狀態為問題
      await dataStorage.confirmPayment(billId, participantId, false);

      // 標記消息操作已完成
      await messageManager.markActionCompleted(messageId);

      console.log(
        `用戶 ${req.user.id} 通過消息拒絕了 參與者 ${participantId} 的付款`
      );

      res.status(200).json({ message: "已標記問題並退回待支付狀態" });
    } catch (error) {
      console.error("拒絕收款失敗:", error);
      res.status(500).json({ error: "拒絕收款失敗" });
    }
  }
);

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

// 創建測試消息（僅用於開發測試）
app.post("/api/messages", authenticateUser, async (req: any, res) => {
  try {
    const { type, content, billId, relatedUserId } = req.body;

    // 如果沒有提供 billId，使用用戶的第一個賬單，或者創建一個測試賬單
    let targetBillId = billId;
    if (!targetBillId || targetBillId === "") {
      // 確保 proxy.bill 存在且是數組
      if (!proxy.bill || !Array.isArray(proxy.bill)) {
        return res.status(400).json({
          error: "無法創建測試消息：數據庫未初始化",
        });
      }
      
      // 過濾掉 null/undefined 元素
      const validBills = proxy.bill.filter((b: any) => b != null);
      
      // 查找用戶的第一個賬單
      const userBills = validBills.filter((b: any) => b && b.created_by === req.user.id);
      if (userBills.length > 0) {
        targetBillId = userBills[0].id || "";
      } else {
        // 如果用戶沒有賬單，返回錯誤
        return res.status(400).json({
          error: "無法創建測試消息：請先創建至少一個賬單",
        });
      }
    }

    // 驗證 billId 是否存在
    // 確保 proxy.bill 存在且是數組
    if (!proxy.bill || !Array.isArray(proxy.bill)) {
      return res.status(500).json({ error: "數據庫未初始化" });
    }
    
    // 過濾掉 null/undefined 元素
    const validBills = proxy.bill.filter((b: any) => b != null);
    const bill = validBills.find((b: any) => b && b.id === targetBillId);
    if (!bill) {
      return res.status(404).json({ error: "指定的賬單不存在" });
    }

    // 創建測試消息
    const message = await messageManager.createMessage({
      type: type || "new_bill",
      senderId: req.user.id,
      recipientId: req.user.id, // 發送給自己
      billId: targetBillId,
      billName: bill.name || "測試賬單",
      title: "測試消息",
      content: content || "這是一條測試消息",
      actionable: false,
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error("Create test message error:", error);
    res.status(500).json({
      error: "創建測試消息失敗",
      details: error instanceof Error ? error.message : String(error),
    });
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

      // 檢查消息是否已經被標記為已完成
      const message = await messageManager.getUserMessages(req.user.id).then(
        (messages) => messages.find((m) => m.id === messageId)
      );
      
      if (message && message.actionCompleted) {
        console.warn(`⚠️  消息 ${messageId} 已經被確認過，跳過重複操作`);
        return res.status(200).json({ message: "收款已確認（重複操作）" });
      }

      // 確認收款
      await dataStorage.confirmPayment(billId, participantId, true);

      // 標記消息操作已完成
      const marked = await messageManager.markActionCompleted(messageId);
      if (!marked) {
        console.warn(`⚠️  無法標記消息 ${messageId} 為已完成`);
      }

      // 發送確認通知給付款人（只有在第一次確認時才發送）
      if (marked) {
        const bill = await dataStorage.getBillById(billId);
        if (bill) {
          await MessageHelper.sendPaymentConfirmedNotification(
            bill,
            participantId
          );
        }
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

// === 食物圖片相關 API ===

// 獲取訂單的食物圖片列表
app.get("/api/food/images/:billId", authenticateUser, async (req: any, res) => {
  try {
    const { billId } = req.params;
    const images = await getFoodImagesByBillId(billId);

    res.status(200).json({
      images: images.map((img) => {
        // 處理 recognitionResult：如果已經是對象則直接使用，如果是字符串則解析
        let recognitionResult = null;
        if (img.recognitionResult) {
          try {
            recognitionResult =
              typeof img.recognitionResult === "string"
                ? JSON.parse(img.recognitionResult)
                : img.recognitionResult;
          } catch (e) {
            console.warn("解析 recognitionResult 失敗:", e);
            recognitionResult = null;
          }
        }

        // 處理 modelRecognitionResult
        let modelRecognitionResult = null;
        if (img.modelRecognitionResult) {
          try {
            modelRecognitionResult =
              typeof img.modelRecognitionResult === "string"
                ? JSON.parse(img.modelRecognitionResult)
                : img.modelRecognitionResult;
          } catch (e) {
            console.warn("解析 modelRecognitionResult 失敗:", e);
            modelRecognitionResult = null;
          }
        }

        // #region agent log
        try {
          const logPath = 'c:\\Users\\Lucas\\OneDrive\\文档\\Code\\dae-2025-4\\.cursor\\debug.log';
          const logData = {
            location: 'server.ts:1672',
            message: 'Food image API response - H13',
            data: {
              imageId: img.id,
              recognitionStatus: img.recognitionStatus,
              hasRecognitionResult: !!recognitionResult,
              hasModelRecognitionResult: !!modelRecognitionResult,
              recognitionError: img.recognitionError,
              modelRecognitionError: img.modelRecognitionError,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'H13'
          };
          fs.appendFileSync(logPath, JSON.stringify(logData) + '\n');
        } catch (e) {}
        // #endregion
        
        return {
          id: img.id,
          filename: img.originalFilename,
          storedPath: img.storedPath,
          fileSize: img.fileSize,
          width: img.width,
          height: img.height,
          recognitionStatus: img.recognitionStatus,
          recognitionResult: recognitionResult,
          recognitionError: img.recognitionError,
          recognitionAt: img.recognitionAt,
          modelRecognitionResult: modelRecognitionResult,
          modelRecognitionConfidence: img.modelRecognitionConfidence,
          modelRecognitionAt: img.modelRecognitionAt,
          modelRecognitionError: img.modelRecognitionError,
          createdAt: img.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("獲取食物圖片列表失敗:", error);
    res.status(500).json({ error: "獲取食物圖片列表失敗" });
  }
});

// 上傳食物圖片
app.post(
  "/api/food/upload",
  authenticateUser,
  upload.single("foodImage"), // 前端使用 "foodImage" 字段名
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "請上傳圖片文件" });
      }

      const { billId } = req.body;
      if (!billId) {
        // 清理上傳的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "缺少訂單 ID" });
      }

      // 驗證訂單是否存在
      const bill = await dataStorage.getBillById(billId);
      if (!bill) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "訂單不存在，請先保存訂單" });
      }

      // 檢查圖片數量限制
      const limitCheck = await checkImageLimit(billId, 10);
      if (!limitCheck.allowed) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: `已達到圖片上傳限制（${limitCheck.current}/10）`,
          limit: limitCheck,
        });
      }

      // 保存圖片
      const imageRecord = await saveFoodImage(
        req.file.path,
        billId,
        req.user.id,
        req.file.originalname
      );

      // 調度識別任務（10秒後執行）
      scheduleRecognition(billId);

      res.status(200).json({
        message: "圖片上傳成功",
        image: {
          id: imageRecord.id,
          filename: imageRecord.originalFilename,
          storedPath: imageRecord.storedPath,
        },
        limit: await checkImageLimit(billId, 10),
      });
    } catch (error) {
      console.error("上傳食物圖片失敗:", error);
      // 清理上傳的文件（如果存在）
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          // 忽略清理錯誤
        }
      }
      res.status(500).json({
        error: "上傳食物圖片失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 手動觸發識別
app.post(
  "/api/food/recognize/:billId",
  authenticateUser,
  async (req: any, res) => {
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
  }
);

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
app.post(
  "/api/food/fix-unrecognized",
  authenticateUser,
  async (req: any, res) => {
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
        message: "修復任務已觸發",
        result,
        usage: usageCheck,
      });
    } catch (error) {
      console.error("修復失敗:", error);
      res.status(500).json({ error: "修復失敗" });
    }
  }
);

// 獲取 API 使用量統計
app.get("/api/food/usage", authenticateUser, async (req: any, res) => {
  try {
    const usage = await checkUsageLimit(1000);
    res.status(200).json(usage);
  } catch (error) {
    console.error("獲取 API 使用量失敗:", error);
    res.status(500).json({ error: "獲取 API 使用量失敗" });
  }
});

// === TensorFlow.js 食物識別 API ===

// 單圖識別（使用 TensorFlow.js 模型）
app.post(
  "/api/food/recognize-tfjs",
  authenticateUser,
  upload.single("image"),
  async (req: any, res) => {
    try {
      if (!tensorflowAvailable) {
        return res.status(503).json({
          error: "TensorFlow.js 不可用",
          message: "請先構建 TensorFlow.js: pnpm rebuild @tensorflow/tfjs-node",
          details: "需要安裝 Visual Studio Build Tools 並構建 native 模塊",
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: "未提供圖像文件" });
      }

      // 檢查模型是否已加載
      if (!modelLoader.isLevel1Loaded()) {
        return res.status(503).json({
          error: "識別模型未加載",
          message: "請先訓練並部署模型文件",
        });
      }

      // 讀取圖像文件
      const imageBuffer = fs.readFileSync(req.file.path);

      // 執行識別
      const result = await recognitionPipeline.recognizeFoodImage(imageBuffer);

      // 清理臨時文件
      fs.unlinkSync(req.file.path);

      res.status(200).json({
        success: true,
        result,
      });
    } catch (error) {
      console.error("TensorFlow.js 識別錯誤:", error);
      res.status(500).json({
        error: "識別失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 批量識別
app.post(
  "/api/food/recognize-tfjs-batch",
  authenticateUser,
  upload.array("images", 10),
  async (req: any, res) => {
    try {
      if (!tensorflowAvailable) {
        return res.status(503).json({
          error: "TensorFlow.js 不可用",
          message: "請先構建 TensorFlow.js: pnpm rebuild @tensorflow/tfjs-node",
          details: "需要安裝 Visual Studio Build Tools 並構建 native 模塊",
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "未提供圖像文件" });
      }

      // 檢查模型是否已加載
      if (!modelLoader.isLevel1Loaded()) {
        return res.status(503).json({
          error: "識別模型未加載",
          message: "請先訓練並部署模型文件",
        });
      }

      // 讀取所有圖像文件
      const imageBuffers = req.files.map((file: any) =>
        fs.readFileSync(file.path)
      );

      // 批量識別
      const results = await recognitionPipeline.recognizeBatch(imageBuffers);

      // 清理臨時文件
      req.files.forEach((file: any) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      res.status(200).json({
        success: true,
        results,
        count: results.length,
      });
    } catch (error) {
      console.error("TensorFlow.js 批量識別錯誤:", error);
      res.status(500).json({
        error: "批量識別失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 獲取模型狀態
app.get("/api/food/models/status", authenticateUser, async (req: any, res) => {
  try {
    if (!tensorflowAvailable) {
      return res.status(200).json({
        available: false,
        message: "TensorFlow.js 不可用，請先構建",
        level1: { loaded: false },
        level2: { loaded: false },
        level3: { loaded: [] },
      });
    }

    const status = {
      available: true,
      level1: {
        loaded: modelLoader.isLevel1Loaded(),
      },
      level2: {
        loaded: modelLoader.isLevel2Loaded(),
      },
      level3: {
        loaded: modelLoader.getLoadedCountries(),
      },
    };

    res.status(200).json(status);
  } catch (error) {
    console.error("獲取模型狀態失敗:", error);
    res.status(500).json({ error: "獲取模型狀態失敗" });
  }
});

// 獲取數據集統計（只讀，不影響數據庫）
app.get("/api/food/data/stats", authenticateUser, async (req: any, res) => {
  try {
    const dataBase = path.join(__dirname, "../data");
    const stats: any = {};

    // 第一層數據統計
    const level1Dir = path.join(dataBase, "level1-food-detection");
    if (fs.existsSync(level1Dir)) {
      const foodDir = path.join(level1Dir, "food");
      const nonFoodDir = path.join(level1Dir, "non-food");

      let foodCount = 0;
      let nonFoodCount = 0;

      if (fs.existsSync(foodDir)) {
        const files = fs.readdirSync(foodDir);
        foodCount = files.filter((file) =>
          /\.(jpg|jpeg|png)$/i.test(file)
        ).length;
      }

      if (fs.existsSync(nonFoodDir)) {
        const files = fs.readdirSync(nonFoodDir);
        nonFoodCount = files.filter((file) =>
          /\.(jpg|jpeg|png)$/i.test(file)
        ).length;
      }

      stats.level1 = {
        food: foodCount,
        nonFood: nonFoodCount,
        total: foodCount + nonFoodCount,
      };
    }

    // 第二層數據統計
    const level2Dir = path.join(dataBase, "level2-country-classification");
    if (fs.existsSync(level2Dir)) {
      const countries = fs.readdirSync(level2Dir, { withFileTypes: true });
      const countryStats: { [key: string]: number } = {};
      let total = 0;

      for (const entry of countries) {
        if (entry.isDirectory()) {
          const countryPath = path.join(level2Dir, entry.name);
          const files = fs.readdirSync(countryPath);
          const count = files.filter((file) =>
            /\.(jpg|jpeg|png)$/i.test(file)
          ).length;
          countryStats[entry.name] = count;
          total += count;
        }
      }

      stats.level2 = {
        countries: countryStats,
        total,
      };
    }

    // 第三層數據統計
    const level3Dir = path.join(dataBase, "level3-fine-grained");
    if (fs.existsSync(level3Dir)) {
      const countries = fs.readdirSync(level3Dir, { withFileTypes: true });
      let total = 0;

      for (const countryEntry of countries) {
        if (countryEntry.isDirectory()) {
          const countryPath = path.join(level3Dir, countryEntry.name);
          const categories = fs.readdirSync(countryPath, {
            withFileTypes: true,
          });

          for (const categoryEntry of categories) {
            if (categoryEntry.isDirectory()) {
              const categoryPath = path.join(countryPath, categoryEntry.name);
              const files = fs.readdirSync(categoryPath);
              const count = files.filter((file) =>
                /\.(jpg|jpeg|png)$/i.test(file)
              ).length;
              total += count;
            }
          }
        }
      }

      stats.level3 = {
        total,
      };
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error("獲取數據統計失敗:", error);
    res.status(500).json({ error: "獲取數據統計失敗" });
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

// 獲取食物圖片（不需要認證，因為圖片 URL 本身已經包含文件名，且文件夾是私有的）
app.get("/food_images/:filename", (req: any, res) => {
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

// 食物識別系統測試頁面（需要認證）
app.get("/food-recognition-test.html", protectPage("protected"), (req, res) => {
  res.sendFile(path.join(__dirname, "../public/food-recognition-test.html"));
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

// 啟動服務器（已移至 startServer 函數，此處註釋掉避免重複監聽）
// app.listen(PORT, async () => {
//   console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
//   console.log(`- 靜態資源來源: public 文件夾`);
//   console.log(`- API 根路徑: /api`);
//   console.log(
//     `- 測試頁面: http://localhost:${PORT}/food-recognition-test.html`
//   );
//
//   // 嘗試加載 TensorFlow.js 模塊（異步，不阻塞服務器啟動）
//   loadTensorFlowModules().then((loaded) => {
//     if (loaded) {
//       // 初始化食物識別模型（異步，不阻塞服務器啟動）
//       initializeFoodRecognitionModels().catch(console.error);
//     }
//   });
// });

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
      console.log(
        `已為訂單 ${billId} 調度識別任務（圖片上傳完成，共 ${allImages.length} 張，10 秒後執行）`
      );

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
app.post(
  "/api/food/recognize/:billId",
  authenticateUser,
  async (req: any, res) => {
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
  }
);

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
app.post(
  "/api/food/fix-unrecognized",
  authenticateUser,
  async (req: any, res) => {
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
  }
);

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

// === 模型版本管理 API ===

// 獲取所有模型版本
app.get(
  "/api/food/models/versions",
  authenticateUser,
  async (req: any, res) => {
    try {
      if (!modelVersionManager) {
        return res.status(503).json({ error: "模型版本管理器未初始化" });
      }

      const { level, country, limit } = req.query;
      const levelNum = level ? parseInt(level as string) : undefined;
      const limitNum = limit ? parseInt(limit as string) : undefined;

      const versions = await modelVersionManager.getVersionHistory(
        levelNum,
        country as string | undefined,
        limitNum
      );

      res.status(200).json({ versions });
    } catch (error) {
      console.error("獲取模型版本失敗:", error);
      res.status(500).json({
        error: "獲取模型版本失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 獲取當前活動版本
app.get("/api/food/models/current", authenticateUser, async (req: any, res) => {
  try {
    if (!modelVersionManager) {
      return res.status(503).json({ error: "模型版本管理器未初始化" });
    }

    const { level, country } = req.query;
    if (!level) {
      return res.status(400).json({ error: "缺少 level 參數" });
    }

    const levelNum = parseInt(level as string);
    const version = await modelVersionManager.getActiveVersion(
      levelNum,
      country as string | undefined
    );

    if (!version) {
      return res.status(404).json({ error: "未找到活動版本" });
    }

    res.status(200).json({ version });
  } catch (error) {
    console.error("獲取當前活動版本失敗:", error);
    res.status(500).json({
      error: "獲取當前活動版本失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 切換模型版本
app.post("/api/food/models/switch", authenticateUser, async (req: any, res) => {
  try {
    if (!modelVersionManager) {
      return res.status(503).json({ error: "模型版本管理器未初始化" });
    }

    const { versionId } = req.body;
    if (!versionId) {
      return res.status(400).json({ error: "缺少 versionId 參數" });
    }

    const version = await modelVersionManager.switchVersion(versionId);

    res.status(200).json({
      message: "版本切換成功",
      version,
    });
  } catch (error) {
    console.error("切換模型版本失敗:", error);
    res.status(500).json({
      error: "切換模型版本失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 記錄新模型版本
app.post(
  "/api/food/models/versions",
  authenticateUser,
  async (req: any, res) => {
    try {
      if (!modelVersionManager) {
        return res.status(503).json({ error: "模型版本管理器未初始化" });
      }

      const {
        level,
        version,
        modelPath,
        country,
        accuracy,
        trainingDate,
        setActive,
      } = req.body;

      if (!level || !version || !modelPath) {
        return res.status(400).json({
          error: "缺少必填參數: level, version, modelPath",
        });
      }

      const versionRecord = await modelVersionManager.recordVersion(
        parseInt(level),
        version,
        modelPath,
        {
          country,
          accuracy: accuracy ? parseFloat(accuracy) : undefined,
          trainingDate,
          setActive: setActive === true || setActive === "true",
        }
      );

      res.status(201).json({
        message: "版本記錄成功",
        version: versionRecord,
      });
    } catch (error) {
      console.error("記錄模型版本失敗:", error);
      res.status(500).json({
        error: "記錄模型版本失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 獲取所有活動版本
app.get("/api/food/models/active", authenticateUser, async (req: any, res) => {
  try {
    if (!modelVersionManager) {
      return res.status(503).json({ error: "模型版本管理器未初始化" });
    }

    const versions = await modelVersionManager.getAllActiveVersions();

    res.status(200).json({ versions });
  } catch (error) {
    console.error("獲取活動版本失敗:", error);
    res.status(500).json({
      error: "獲取活動版本失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// === 食物推薦 API ===

// 獲取訂單的食物推薦（基於 API 和模型識別結果）
app.get("/api/bills/:billId/food-recommendations", authenticateUser, async (req: any, res) => {
  try {
    const { billId } = req.params;

    // 驗證訂單存在且用戶有權限
    const bill = await dataStorage.getBillById(billId);
    if (!bill) {
      return res.status(404).json({ error: "訂單不存在" });
    }

    if (bill.createdBy !== req.user.id) {
      return res.status(403).json({ error: "無權限訪問此訂單" });
    }

    // 獲取訂單的所有食物圖片
    const images = await getFoodImagesByBillId(billId);

    if (images.length === 0) {
      return res.status(200).json({
        recommendations: [],
        message: "該訂單沒有食物圖片",
      });
    }

    // 獲取多樣性推薦
    const recommendations = getDiverseRecommendations(images);

    res.status(200).json({
      recommendations,
      formatted: formatRecommendations(recommendations),
      imageCount: images.length,
    });
  } catch (error) {
    console.error("獲取食物推薦失敗:", error);
    res.status(500).json({
      error: "獲取食物推薦失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 獲取單張圖片的食物推薦
app.get("/api/food-images/:imageId/recommendations", authenticateUser, async (req: any, res) => {
  try {
    const { imageId } = req.params;

    // 獲取圖片記錄
    const image = await getFoodImageById(parseInt(imageId));

    if (!image) {
      return res.status(404).json({ error: "圖片不存在" });
    }

    // 驗證權限
    const bill = await dataStorage.getBillById(image.billId);
    if (!bill || bill.createdBy !== req.user.id) {
      return res.status(403).json({ error: "無權限訪問此圖片" });
    }

    // 獲取推薦
    const recommendations = getRecommendedFoods(image);

    res.status(200).json({
      recommendations,
      formatted: formatRecommendations(recommendations),
    });
  } catch (error) {
    console.error("獲取食物推薦失敗:", error);
    res.status(500).json({
      error: "獲取食物推薦失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// === 餐廳管理 API ===

// 獲取餐廳列表（支持分頁、篩選、搜索）
app.get("/api/restaurants", authenticateUser, async (req: any, res) => {
  try {
    const {
      page = "1",
      limit = "20",
      cuisine_type,
      price_range,
      min_rating,
      city,
      search,
      district,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // 確保 proxy.restaurant 存在且是數組
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      return res.status(200).json({
        restaurants: [],
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0,
      });
    }

    // 過濾有效的餐廳（排除 null/undefined）
    let restaurants = proxy.restaurant.filter(
      (r: any) => r != null && r.is_active === 1
    );

    // 城市篩選（默認只顯示香港）
    if (city) {
      restaurants = restaurants.filter((r: any) => r.city === city);
    } else {
      // 默認只顯示香港
      restaurants = restaurants.filter((r: any) => r.city === "香港");
    }

    // 菜系類型篩選
    if (cuisine_type) {
      const cuisineTypes = Array.isArray(cuisine_type)
        ? cuisine_type
        : [cuisine_type];
      restaurants = restaurants.filter((r: any) => {
        if (!r.cuisine_type) return false;
        return cuisineTypes.some((type) =>
          r.cuisine_type.toLowerCase().includes(type.toLowerCase())
        );
      });
    }

    // 價格範圍篩選
    if (price_range) {
      const priceRanges = Array.isArray(price_range)
        ? price_range
        : [price_range];
      restaurants = restaurants.filter(
        (r: any) => r.price_range && priceRanges.includes(r.price_range)
      );
    }

    // 最小評分篩選
    if (min_rating) {
      const minRating = parseFloat(min_rating);
      restaurants = restaurants.filter(
        (r: any) => r.rating && r.rating >= minRating
      );
    }

    // 區域篩選（通過地址匹配）
    if (district) {
      const districts = Array.isArray(district) ? district : [district];
      restaurants = restaurants.filter((r: any) => {
        if (!r.address) return false;
        return districts.some((d) => r.address.includes(d));
      });
    }

    // 搜索（名稱、地址、描述）
    if (search) {
      const searchLower = search.toLowerCase();
      restaurants = restaurants.filter((r: any) => {
        const name = (r.name || "").toLowerCase();
        const nameEn = (r.name_en || "").toLowerCase();
        const address = (r.address || "").toLowerCase();
        const description = (r.description || "").toLowerCase();
        return (
          name.includes(searchLower) ||
          nameEn.includes(searchLower) ||
          address.includes(searchLower) ||
          description.includes(searchLower)
        );
      });
    }

    // 排序（按評分降序，然後按評論數降序）
    restaurants.sort((a: any, b: any) => {
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;
      if (ratingA !== ratingB) {
        return ratingB - ratingA;
      }
      const reviewA = a.review_count || 0;
      const reviewB = b.review_count || 0;
      return reviewB - reviewA;
    });

    // 分頁
    const total = restaurants.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginatedRestaurants = restaurants.slice(offset, offset + limitNum);

    // 格式化返回數據
    const formattedRestaurants = paginatedRestaurants.map((r: any) => ({
      id: r.id,
      name: r.name,
      name_en: r.name_en,
      description: r.description,
      cuisine_type: r.cuisine_type,
      price_range: r.price_range,
      rating: r.rating,
      review_count: r.review_count,
      address: r.address,
      city: r.city,
      latitude: r.latitude,
      longitude: r.longitude,
      phone: r.phone,
      website: r.website,
      image_url: r.image_url,
      source_url: r.source_url || null, // 返回 OpenRice URL
      tags: r.tags ? JSON.parse(r.tags) : [],
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    res.status(200).json({
      restaurants: formattedRestaurants,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    });
  } catch (error) {
    console.error("獲取餐廳列表失敗:", error);
    res.status(500).json({
      error: "獲取餐廳列表失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// === 具體路由必須在動態路由之前 ===

// 獲取餐廳推薦（必須在 /:id 之前）
app.get("/api/restaurants/recommend", authenticateUser, async (req: any, res) => {
  try {
    const {
      limit = "10",
      latitude,
      longitude,
      price_range,
      cuisine_type,
      min_score = "0.0",
    } = req.query;

    const userId = req.user.id;

    // 從用戶歷史偏好中提取偏好信息
    const userHistoryPreferences = extractUserPreferences(userId);

    // 構建推薦選項
    const options: RecommendationOptions = {
      limit: parseInt(limit as string, 10),
      userLatitude: latitude ? parseFloat(latitude as string) : undefined,
      userLongitude: longitude ? parseFloat(longitude as string) : undefined,
      userPreferences: {
        priceRange: price_range
          ? (Array.isArray(price_range) ? price_range : [price_range])
          : userHistoryPreferences.preferredPriceRanges.length > 0
          ? userHistoryPreferences.preferredPriceRanges
          : undefined,
        cuisineTypes: cuisine_type
          ? (Array.isArray(cuisine_type) ? cuisine_type : [cuisine_type])
          : userHistoryPreferences.preferredCuisineTypes.length > 0
          ? userHistoryPreferences.preferredCuisineTypes
          : undefined,
      },
      minScore: parseFloat(min_score as string),
    };

    // 檢查餐廳數據
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      console.warn("⚠️  proxy.restaurant 不存在或不是數組");
      return res.status(200).json({
        recommendations: [],
        count: 0,
        message: "暫無餐廳數據，請先運行爬蟲或添加餐廳數據",
        userPreferences: {
          cuisineTypes: [],
          priceRanges: [],
        },
      });
    }

    // 獲取推薦餐廳
    const recommendations = await recommendRestaurants(userId, options);

    // 格式化返回數據
    const formattedRecommendations = recommendations.map((item) => ({
      restaurant: {
        id: item.restaurant.id,
        name: item.restaurant.name,
        name_en: item.restaurant.name_en,
        description: item.restaurant.description,
        cuisine_type: item.restaurant.cuisine_type,
        price_range: item.restaurant.price_range,
        rating: item.restaurant.rating,
        review_count: item.restaurant.review_count,
        address: item.restaurant.address,
        city: item.restaurant.city,
        latitude: item.restaurant.latitude,
        longitude: item.restaurant.longitude,
        phone: item.restaurant.phone,
        website: item.restaurant.website,
        image_url: item.restaurant.image_url,
        tags: item.restaurant.tags ? JSON.parse(item.restaurant.tags) : [],
      },
      score: item.score,
      breakdown: item.breakdown,
    }));

    res.status(200).json({
      recommendations: formattedRecommendations,
      count: formattedRecommendations.length,
      userPreferences: {
        cuisineTypes: userHistoryPreferences.preferredCuisineTypes,
        priceRanges: userHistoryPreferences.preferredPriceRanges,
      },
    });
  } catch (error) {
    console.error("獲取餐廳推薦失敗:", error);
    res.status(500).json({
      error: "獲取餐廳推薦失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 獲取下一個餐廳（用於心動模式，必須在 /:id 之前）
app.get(
  "/api/restaurants/next",
  authenticateUser,
  async (req: any, res) => {
    try {
      const {
        exclude_ids,
        cuisine_type,
        min_rating,
        limit = "1",
      } = req.query;

      // 確保 proxy 數組存在
      if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
        console.warn("⚠️  proxy.restaurant 不存在或不是數組");
        return res.status(200).json({ 
          restaurant: null,
          message: "暫無餐廳數據，請先運行爬蟲或添加餐廳數據"
        });
      }

      // 獲取用戶已看過的餐廳 ID（從偏好記錄中）
      let seenRestaurantIds: string[] = [];
      if (
        proxy.user_restaurant_preference &&
        Array.isArray(proxy.user_restaurant_preference)
      ) {
        const validPreferences = proxy.user_restaurant_preference.filter(
          (p: any) => p != null && p.user_id === req.user.id
        );
        seenRestaurantIds = validPreferences.map((p: any) => p.restaurant_id);
      }

      // 合併排除列表
      const excludeIds = [
        ...seenRestaurantIds,
        ...(exclude_ids ? (Array.isArray(exclude_ids) ? exclude_ids : [exclude_ids]) : []),
      ];

      // 過濾餐廳
      const validRestaurants = proxy.restaurant.filter((r: any) => r != null);
      if (validRestaurants.length === 0) {
        console.warn("⚠️  數據庫中沒有餐廳數據");
        return res.status(200).json({
          restaurant: null,
          message: "暫無餐廳數據，請先運行爬蟲或添加餐廳數據",
        });
      }

      let restaurants = validRestaurants.filter(
        (r: any) =>
          r.is_active === 1 &&
          r.city === "香港" &&
          !excludeIds.includes(r.id)
      );

      // 菜系類型篩選
      if (cuisine_type) {
        const cuisineTypes = Array.isArray(cuisine_type)
          ? cuisine_type
          : [cuisine_type];
        restaurants = restaurants.filter((r: any) => {
          if (!r.cuisine_type) return false;
          return cuisineTypes.some((type) =>
            r.cuisine_type.toLowerCase().includes(type.toLowerCase())
          );
        });
      }

      // 最小評分篩選
      if (min_rating) {
        const minRating = parseFloat(min_rating);
        restaurants = restaurants.filter(
          (r: any) => r.rating && r.rating >= minRating
        );
      }

      // 隨機排序（增加多樣性）
      restaurants.sort(() => Math.random() - 0.5);

      // 限制數量
      const limitNum = parseInt(limit, 10);
      const selectedRestaurants = restaurants.slice(0, limitNum);

      if (selectedRestaurants.length === 0) {
        return res.status(200).json({
          restaurant: null,
          message: "沒有更多餐廳了",
        });
      }

      // 格式化返回數據
      const restaurant = selectedRestaurants[0];
      
      // 如果餐廳沒有評分（既沒有原始評分也沒有 LLM 評分），嘗試獲取 LLM 評分
      if (!restaurant.rating && !restaurant.llm_rating && restaurant.source_url && req.user?.id && restaurant.id) {
        try {
          // #region agent log
          try {
            const fs = await import('fs');
            const logPath = 'c:\\Users\\Lucas\\OneDrive\\文档\\Code\\dae-2025-4\\.cursor\\debug.log';
            const logData = {
              location: 'server.ts:3018',
              message: 'Before calling LLM for rating - H11',
              data: {
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                restaurantUrl: restaurant.source_url,
                hasRating: !!restaurant.rating,
                hasLlmRating: !!restaurant.llm_rating,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'H11'
            };
            fs.appendFileSync(logPath, JSON.stringify(logData) + '\n');
          } catch (e) {}
          // #endregion
          
          const { getRestaurantLLMRating } = await import("./llm/restaurantLLMService.js");
          const llmResult = await getRestaurantLLMRating(
            restaurant.id,
            restaurant.name,
            restaurant.source_url,
            req.user.id
          );
          
          // #region agent log
          try {
            const fs = await import('fs');
            const logPath = 'c:\\Users\\Lucas\\OneDrive\\文档\\Code\\dae-2025-4\\.cursor\\debug.log';
            const logData = {
              location: 'server.ts:3031',
              message: 'After calling LLM for rating - H11',
              data: {
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                llmRating: llmResult.rating,
                llmConfidence: llmResult.confidence,
                hasReasoning: !!llmResult.reasoning,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'H11'
            };
            fs.appendFileSync(logPath, JSON.stringify(logData) + '\n');
          } catch (e) {}
          // #endregion
          
          // 直接使用 LLM 結果更新餐廳對象（因為緩存已經保存到數據庫）
          restaurant.llm_rating = llmResult.rating;
          restaurant.llm_rating_confidence = llmResult.confidence;
          restaurant.llm_rating_reasoning = llmResult.reasoning || null;
          console.log(`✅ 已獲取 LLM 評分: ${restaurant.name} - ${llmResult.rating} (置信度: ${llmResult.confidence})`);
        } catch (error: any) {
          console.warn(`⚠️ 獲取 LLM 評分失敗 (${restaurant.name}):`, error?.message || String(error));
          // 即使失敗也繼續返回餐廳（只是沒有評分）
        }
      }
      
      const formattedRestaurant = {
        id: restaurant.id,
        name: restaurant.name,
        name_en: restaurant.name_en,
        description: restaurant.description,
        cuisine_type: restaurant.cuisine_type,
        price_range: restaurant.price_range,
        rating: restaurant.rating,
        llm_rating: restaurant.llm_rating,
        llm_rating_confidence: restaurant.llm_rating_confidence,
        llm_rating_reasoning: restaurant.llm_rating_reasoning,
        review_count: restaurant.review_count,
        address: restaurant.address,
        city: restaurant.city,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        phone: restaurant.phone,
        website: restaurant.website,
        image_url: restaurant.image_url,
        source_url: restaurant.source_url || null, // 返回 OpenRice URL
        tags: restaurant.tags ? JSON.parse(restaurant.tags) : [],
      };
      
      // #region agent log - DISABLED (causing server crash)
      // #endregion

      res.status(200).json({
        restaurant: formattedRestaurant,
        remaining: restaurants.length - 1,
      });
    } catch (error) {
      console.error("獲取下一個餐廳失敗:", error);
      res.status(500).json({
        error: "獲取下一個餐廳失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 獲取用戶的收藏和喜歡的餐廳（必須在動態路由之前）
app.get("/api/restaurants/my-favorites", authenticateUser, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { type = "all" } = req.query; // all, favorite, like

    // 確保 proxy 數組存在
    if (!proxy.user_restaurant_preference || !Array.isArray(proxy.user_restaurant_preference)) {
      return res.status(200).json({
        restaurants: [],
        count: 0,
        message: "暫無偏好記錄",
      });
    }

    // 獲取用戶的偏好記錄
    let preferences = proxy.user_restaurant_preference.filter(
      (p: any) => p != null && p.user_id === userId
    );

    // 根據類型篩選
    if (type === "favorite") {
      preferences = preferences.filter((p: any) => p.preference === "favorite");
    } else if (type === "like") {
      preferences = preferences.filter((p: any) => p.preference === "like");
    } else {
      // all: 只顯示 favorite 和 like，不顯示 dislike
      preferences = preferences.filter(
        (p: any) => p.preference === "favorite" || p.preference === "like"
      );
    }

    // 獲取餐廳 ID 列表
    const restaurantIds = preferences.map((p: any) => p.restaurant_id);

    if (restaurantIds.length === 0) {
      return res.status(200).json({
        restaurants: [],
        count: 0,
        message: type === "favorite" ? "暫無收藏餐廳" : type === "like" ? "暫無喜歡餐廳" : "暫無偏好記錄",
      });
    }

    // 獲取餐廳詳情
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      return res.status(200).json({
        restaurants: [],
        count: 0,
        message: "暫無餐廳數據",
      });
    }

    const restaurants = proxy.restaurant
      .filter((r: any) => r != null && restaurantIds.includes(r.id) && r.is_active === 1)
      .map((r: any) => {
        // 找到對應的偏好記錄
        const pref = preferences.find((p: any) => p.restaurant_id === r.id);
        
        // #region agent log - DISABLED (causing server crash)
        // #endregion
        
        return {
          id: r.id,
          name: r.name,
          name_en: r.name_en,
          description: r.description,
          cuisine_type: r.cuisine_type,
          price_range: r.price_range,
          rating: r.rating,
          llm_rating: r.llm_rating,
          llm_rating_confidence: r.llm_rating_confidence,
          llm_rating_reasoning: r.llm_rating_reasoning,
          review_count: r.review_count,
          address: r.address,
          city: r.city,
          latitude: r.latitude,
          longitude: r.longitude,
          phone: r.phone,
          website: r.website,
          image_url: r.image_url,
          source_url: r.source_url || null, // 返回 OpenRice URL
          tags: r.tags ? JSON.parse(r.tags) : [],
          preference: pref?.preference || "like", // 偏好類型
          preference_date: pref?.created_at || null, // 偏好記錄時間
        };
      });

    // 按偏好時間排序（最新的在前）
    restaurants.sort((a: any, b: any) => {
      const dateA = a.preference_date ? new Date(a.preference_date).getTime() : 0;
      const dateB = b.preference_date ? new Date(b.preference_date).getTime() : 0;
      return dateB - dateA;
    });

    res.status(200).json({
      restaurants,
      count: restaurants.length,
      type: type,
    });
  } catch (error) {
    console.error("獲取收藏餐廳失敗:", error);
    res.status(500).json({
      error: "獲取收藏餐廳失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 獲取餐廳詳情（動態路由，必須在具體路由之後）
app.get("/api/restaurants/:id", authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;

    // 確保 proxy.restaurant 存在且是數組
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      return res.status(404).json({ error: "餐廳不存在" });
    }

    const validRestaurants = proxy.restaurant.filter((r: any) => r != null);
    const restaurant = validRestaurants.find((r: any) => r.id === id);

    if (!restaurant || restaurant.is_active !== 1) {
      return res.status(404).json({ error: "餐廳不存在" });
    }

    // 格式化返回數據
    const formattedRestaurant = {
      id: restaurant.id,
      name: restaurant.name,
      name_en: restaurant.name_en,
      description: restaurant.description,
      cuisine_type: restaurant.cuisine_type,
      price_range: restaurant.price_range,
      rating: restaurant.rating,
      review_count: restaurant.review_count,
      address: restaurant.address,
      city: restaurant.city,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      phone: restaurant.phone,
      website: restaurant.website,
      image_url: restaurant.image_url,
      source_url: restaurant.source_url || null, // 返回 OpenRice URL
      tags: restaurant.tags ? JSON.parse(restaurant.tags) : [],
      created_at: restaurant.created_at,
      updated_at: restaurant.updated_at,
    };

    res.status(200).json({ restaurant: formattedRestaurant });
  } catch (error) {
    console.error("獲取餐廳詳情失敗:", error);
    res.status(500).json({
      error: "獲取餐廳詳情失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 搜索餐廳（根據食物類型或菜系）
app.get("/api/restaurants/search", authenticateUser, async (req: any, res) => {
  try {
    const {
      food_type,
      cuisine_type,
      city = "香港",
      min_rating,
      limit = "10",
    } = req.query;

    // 確保 proxy.restaurant 存在且是數組
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      return res.status(200).json({ restaurants: [] });
    }

    // 過濾有效的餐廳（排除 null/undefined，只顯示香港）
    let restaurants = proxy.restaurant.filter(
      (r: any) => r != null && r.is_active === 1 && r.city === city
    );

    // 根據菜系類型篩選
    if (cuisine_type) {
      const cuisineTypes = Array.isArray(cuisine_type)
        ? cuisine_type
        : [cuisine_type];
      restaurants = restaurants.filter((r: any) => {
        if (!r.cuisine_type) return false;
        return cuisineTypes.some((type) =>
          r.cuisine_type.toLowerCase().includes(type.toLowerCase())
        );
      });
    }

    // 根據食物類型搜索（在名稱、描述、標籤中搜索）
    if (food_type) {
      const foodTypes = Array.isArray(food_type) ? food_type : [food_type];
      restaurants = restaurants.filter((r: any) => {
        const searchText = [
          r.name,
          r.name_en,
          r.description,
          r.tags ? JSON.parse(r.tags).join(" ") : "",
        ]
          .filter((text) => text)
          .join(" ")
          .toLowerCase();

        return foodTypes.some((food) => searchText.includes(food.toLowerCase()));
      });
    }

    // 最小評分篩選
    if (min_rating) {
      const minRating = parseFloat(min_rating);
      restaurants = restaurants.filter(
        (r: any) => r.rating && r.rating >= minRating
      );
    }

    // 排序（按評分降序）
    restaurants.sort((a: any, b: any) => {
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;
      return ratingB - ratingA;
    });

    // 限制數量
    const limitNum = parseInt(limit, 10);
    const limitedRestaurants = restaurants.slice(0, limitNum);

    // 格式化返回數據
    const formattedRestaurants = limitedRestaurants.map((r: any) => ({
      id: r.id,
      name: r.name,
      name_en: r.name_en,
      description: r.description,
      cuisine_type: r.cuisine_type,
      price_range: r.price_range,
      rating: r.rating,
      review_count: r.review_count,
      address: r.address,
      city: r.city,
      latitude: r.latitude,
      longitude: r.longitude,
      phone: r.phone,
      website: r.website,
      image_url: r.image_url,
      tags: r.tags ? JSON.parse(r.tags) : [],
      distance: null, // 距離計算需要用戶位置，這裡先返回 null
    }));

    res.status(200).json({
      restaurants: formattedRestaurants,
      total: restaurants.length,
      matched: formattedRestaurants.length,
    });
  } catch (error) {
    console.error("搜索餐廳失敗:", error);
    res.status(500).json({
      error: "搜索餐廳失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 根據食物識別結果推薦餐廳
app.get(
  "/api/restaurants/recommend-by-food",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { country, food_name, limit = "10" } = req.query;

      if (!country) {
        return res.status(400).json({ error: "缺少國家參數" });
      }

      // 將國家映射到菜系類型
      const countryToCuisine: { [key: string]: string } = {
        chinese: "中餐",
        japanese: "日料",
        korean: "韓式",
        thai: "泰式",
        indian: "印度菜",
        italian: "義式",
        french: "法式",
        mexican: "墨西哥",
        american: "美式",
      };

      const cuisineType = countryToCuisine[country.toLowerCase()];
      if (!cuisineType) {
        return res.status(400).json({ error: "不支持的國家類型" });
      }

      // 構建搜索參數
      const searchParams: any = {
        cuisine_type: cuisineType,
        city: "香港",
      };

      if (food_name) {
        searchParams.food_type = food_name;
      }

      // 調用搜索 API 的邏輯
      if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
        return res.status(200).json({ restaurants: [] });
      }

      let restaurants = proxy.restaurant.filter(
        (r: any) => r != null && r.is_active === 1 && r.city === "香港"
      );

      // 根據菜系類型篩選
      restaurants = restaurants.filter((r: any) => {
        if (!r.cuisine_type) return false;
        return r.cuisine_type.toLowerCase().includes(cuisineType.toLowerCase());
      });

      // 根據食物名稱搜索（如果提供）
      if (food_name) {
        const foodName = food_name.toLowerCase();
        restaurants = restaurants.filter((r: any) => {
          const searchText = [
            r.name,
            r.name_en,
            r.description,
            r.tags ? JSON.parse(r.tags).join(" ") : "",
          ]
            .filter((text) => text)
            .join(" ")
            .toLowerCase();
          return searchText.includes(foodName);
        });
      }

      // 排序（按評分降序）
      restaurants.sort((a: any, b: any) => {
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        return ratingB - ratingA;
      });

      // 限制數量
      const limitNum = parseInt(limit, 10);
      const limitedRestaurants = restaurants.slice(0, limitNum);

      // 格式化返回數據
      const formattedRestaurants = limitedRestaurants.map((r: any) => ({
        id: r.id,
        name: r.name,
        name_en: r.name_en,
        description: r.description,
        cuisine_type: r.cuisine_type,
        price_range: r.price_range,
        rating: r.rating,
        llm_rating: r.llm_rating,
        llm_rating_confidence: r.llm_rating_confidence,
        llm_rating_reasoning: r.llm_rating_reasoning,
        review_count: r.review_count,
        address: r.address,
        city: r.city,
        latitude: r.latitude,
        longitude: r.longitude,
        phone: r.phone,
        website: r.website,
        image_url: r.image_url,
        tags: r.tags ? JSON.parse(r.tags) : [],
        match_reason: food_name
          ? `匹配 ${cuisineType} 和 ${food_name}`
          : `匹配 ${cuisineType}`,
      }));

      res.status(200).json({
        restaurants: formattedRestaurants,
        total: restaurants.length,
        matched: formattedRestaurants.length,
        criteria: {
          country,
          cuisine_type: cuisineType,
          food_name: food_name || null,
        },
      });
    } catch (error) {
      console.error("根據食物推薦餐廳失敗:", error);
      res.status(500).json({
        error: "根據食物推薦餐廳失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// === 用戶餐廳偏好 API ===

// 記錄用戶對餐廳的偏好（like/dislike/favorite）
app.post(
  "/api/restaurants/:id/preference",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { id: restaurantId } = req.params;
      const { preference } = req.body; // like, dislike, favorite

      if (!preference || !["like", "dislike", "favorite"].includes(preference)) {
        return res.status(400).json({
          error: "偏好類型必須是 like, dislike 或 favorite",
        });
      }

      // 驗證餐廳存在
      if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
        return res.status(404).json({ error: "餐廳不存在" });
      }

      const validRestaurants = proxy.restaurant.filter((r: any) => r != null);
      const restaurant = validRestaurants.find((r: any) => r.id === restaurantId);

      if (!restaurant) {
        return res.status(404).json({ error: "餐廳不存在" });
      }

      // 檢查是否已有偏好記錄
      if (!proxy.user_restaurant_preference || !Array.isArray(proxy.user_restaurant_preference)) {
        return res.status(500).json({ error: "數據庫錯誤" });
      }

      const validPreferences = proxy.user_restaurant_preference.filter(
        (p: any) => p != null
      );
      const existingPreference = validPreferences.find(
        (p: any) => p.user_id === req.user.id && p.restaurant_id === restaurantId
      );

      const now = new Date().toISOString();
      const preferenceId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      if (existingPreference) {
        // 更新現有偏好
        existingPreference.preference = preference;
        existingPreference.updated_at = now;

        res.status(200).json({
          message: "偏好已更新",
          preference: {
            id: existingPreference.id,
            user_id: existingPreference.user_id,
            restaurant_id: existingPreference.restaurant_id,
            preference: existingPreference.preference,
            updated_at: existingPreference.updated_at,
          },
        });
      } else {
        // 創建新偏好
        const newPreference = {
          id: preferenceId,
          user_id: req.user.id,
          restaurant_id: restaurantId,
          preference: preference,
          created_at: now,
          updated_at: now,
        };

        proxy.user_restaurant_preference.push(newPreference);

        res.status(201).json({
          message: "偏好已記錄",
          preference: newPreference,
        });
      }
    } catch (error) {
      console.error("記錄餐廳偏好失敗:", error);
      res.status(500).json({
        error: "記錄餐廳偏好失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// 獲取用戶的餐廳偏好列表
app.get(
  "/api/users/:userId/preferences",
  authenticateUser,
  async (req: any, res) => {
    try {
      const { userId } = req.params;

      // 驗證權限（只能查看自己的偏好）
      if (userId !== req.user.id) {
        return res.status(403).json({ error: "無權限訪問" });
      }

      // 確保 proxy 數組存在
      if (
        !proxy.user_restaurant_preference ||
        !Array.isArray(proxy.user_restaurant_preference)
      ) {
        return res.status(200).json({ preferences: [] });
      }

      const validPreferences = proxy.user_restaurant_preference.filter(
        (p: any) => p != null && p.user_id === userId
      );

      // 獲取餐廳詳情
      const preferencesWithRestaurants = validPreferences.map((pref: any) => {
        const restaurant =
          proxy.restaurant &&
          Array.isArray(proxy.restaurant)
            ? proxy.restaurant.find((r: any) => r && r.id === pref.restaurant_id)
            : null;

        return {
          id: pref.id,
          restaurant_id: pref.restaurant_id,
          preference: pref.preference,
          restaurant: restaurant
            ? {
                id: restaurant.id,
                name: restaurant.name,
                name_en: restaurant.name_en,
                cuisine_type: restaurant.cuisine_type,
                rating: restaurant.rating,
                llm_rating: restaurant.llm_rating,
                llm_rating_confidence: restaurant.llm_rating_confidence,
                llm_rating_reasoning: restaurant.llm_rating_reasoning,
                address: restaurant.address,
                city: restaurant.city,
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
                image_url: restaurant.image_url,
                source_url: restaurant.source_url || null,
              }
            : null,
          created_at: pref.created_at,
          updated_at: pref.updated_at,
        };
      });

      res.status(200).json({
        preferences: preferencesWithRestaurants,
        total: preferencesWithRestaurants.length,
      });
    } catch (error) {
      console.error("獲取用戶偏好失敗:", error);
      res.status(500).json({
        error: "獲取用戶偏好失敗",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// === 心動模式 API ===
// 注意：/api/restaurants/next 路由已在上面定義（第 2921 行），此處不再重複定義

// 記錄餐廳偏好（like/dislike/favorite）- 統一的 feedback API
app.post("/api/restaurants/feedback", authenticateUser, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { restaurant_id, preference } = req.body; // preference: "like", "dislike", "favorite"

    if (!restaurant_id || !preference) {
      return res.status(400).json({ error: "缺少必要參數" });
    }

    if (!["like", "dislike", "favorite"].includes(preference)) {
      return res.status(400).json({ error: "無效的偏好類型" });
    }

    // 驗證餐廳存在
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      return res.status(404).json({ error: "餐廳不存在" });
    }

    const validRestaurants = proxy.restaurant.filter((r: any) => r != null);
    const restaurant = validRestaurants.find((r: any) => r.id === restaurant_id);

    if (!restaurant || restaurant.is_active !== 1) {
      return res.status(404).json({ error: "餐廳不存在" });
    }

    // 檢查是否已有偏好記錄
    if (!proxy.user_restaurant_preference || !Array.isArray(proxy.user_restaurant_preference)) {
      return res.status(500).json({ error: "數據庫錯誤" });
    }

    const validPreferences = proxy.user_restaurant_preference.filter(
      (p: any) => p != null
    );
    const existingPreference = validPreferences.find(
      (p: any) => p.user_id === userId && p.restaurant_id === restaurant_id
    );

    const now = new Date().toISOString();
    const preferenceId = `${userId}_${restaurant_id}_${Date.now()}`;

    if (existingPreference) {
      // 更新現有記錄
      db.prepare(
        `UPDATE user_restaurant_preference 
         SET preference = ?, updated_at = ? 
         WHERE user_id = ? AND restaurant_id = ?`
      ).run(preference, now, userId, restaurant_id);
    } else {
      // 創建新記錄
      db.prepare(
        `INSERT INTO user_restaurant_preference (id, user_id, restaurant_id, preference, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(preferenceId, userId, restaurant_id, preference, now, now);
    }

    res.status(200).json({
      success: true,
      message: preference === "favorite" ? "已收藏" : preference === "like" ? "已添加到喜歡" : "已記錄",
      preference: preference,
    });
  } catch (error) {
    console.error("記錄餐廳偏好失敗:", error);
    res.status(500).json({
      error: "記錄餐廳偏好失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 取消餐廳偏好（刪除偏好記錄）
app.delete("/api/restaurants/feedback", authenticateUser, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { restaurant_id } = req.body;

    if (!restaurant_id) {
      return res.status(400).json({ error: "缺少餐廳 ID" });
    }

    // 刪除偏好記錄
    const result = db.prepare(
      `DELETE FROM user_restaurant_preference 
       WHERE user_id = ? AND restaurant_id = ?`
    ).run(userId, restaurant_id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "偏好記錄不存在" });
    }

    res.status(200).json({
      success: true,
      message: "已取消偏好",
    });
  } catch (error) {
    console.error("取消餐廳偏好失敗:", error);
    res.status(500).json({
      error: "取消餐廳偏好失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// === 餐廳推薦 API ===

// 獲取餐廳推薦
app.get("/api/restaurants/recommend", authenticateUser, async (req: any, res) => {
  try {
    const {
      limit = "10",
      latitude,
      longitude,
      price_range,
      cuisine_type,
      min_score = "0.0",
    } = req.query;

    const userId = req.user.id;

    // 從用戶歷史偏好中提取偏好信息
    const userHistoryPreferences = extractUserPreferences(userId);

    // 構建推薦選項
    const options: RecommendationOptions = {
      limit: parseInt(limit as string, 10),
      userLatitude: latitude ? parseFloat(latitude as string) : undefined,
      userLongitude: longitude ? parseFloat(longitude as string) : undefined,
      userPreferences: {
        priceRange: price_range
          ? (Array.isArray(price_range) ? price_range : [price_range])
          : userHistoryPreferences.preferredPriceRanges.length > 0
          ? userHistoryPreferences.preferredPriceRanges
          : undefined,
        cuisineTypes: cuisine_type
          ? (Array.isArray(cuisine_type) ? cuisine_type : [cuisine_type])
          : userHistoryPreferences.preferredCuisineTypes.length > 0
          ? userHistoryPreferences.preferredCuisineTypes
          : undefined,
      },
      minScore: parseFloat(min_score as string),
    };

    // 檢查餐廳數據
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      console.warn("⚠️  proxy.restaurant 不存在或不是數組");
      return res.status(200).json({
        recommendations: [],
        count: 0,
        message: "暫無餐廳數據，請先運行爬蟲或添加餐廳數據",
        userPreferences: {
          cuisineTypes: [],
          priceRanges: [],
        },
      });
    }

    // 獲取推薦餐廳
    const recommendations = await recommendRestaurants(userId, options);

    // 格式化返回數據
    const formattedRecommendations = recommendations.map((item) => ({
      restaurant: {
        id: item.restaurant.id,
        name: item.restaurant.name,
        name_en: item.restaurant.name_en,
        description: item.restaurant.description,
        cuisine_type: item.restaurant.cuisine_type,
        price_range: item.restaurant.price_range,
        rating: item.restaurant.rating,
        review_count: item.restaurant.review_count,
        address: item.restaurant.address,
        city: item.restaurant.city,
        latitude: item.restaurant.latitude,
        longitude: item.restaurant.longitude,
        phone: item.restaurant.phone,
        website: item.restaurant.website,
        image_url: item.restaurant.image_url,
        tags: item.restaurant.tags ? JSON.parse(item.restaurant.tags) : [],
      },
      score: item.score,
      breakdown: item.breakdown,
    }));

    res.status(200).json({
      recommendations: formattedRecommendations,
      count: formattedRecommendations.length,
      userPreferences: {
        cuisineTypes: userHistoryPreferences.preferredCuisineTypes,
        priceRanges: userHistoryPreferences.preferredPriceRanges,
      },
    });
  } catch (error) {
    console.error("獲取餐廳推薦失敗:", error);
    res.status(500).json({
      error: "獲取餐廳推薦失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 記錄用戶餐廳偏好（like/dislike/favorite）
app.post("/api/restaurants/feedback", authenticateUser, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { restaurant_id, preference } = req.body; // preference: "like", "dislike", "favorite"

    if (!restaurant_id || !preference) {
      return res.status(400).json({ error: "缺少必要參數" });
    }

    if (!["like", "dislike", "favorite"].includes(preference)) {
      return res.status(400).json({ error: "無效的偏好類型" });
    }

    // 檢查餐廳是否存在
    if (!proxy.restaurant || !Array.isArray(proxy.restaurant)) {
      return res.status(404).json({ error: "餐廳不存在" });
    }

    const restaurant = proxy.restaurant.find(
      (r: any) => r != null && r.id === restaurant_id && r.is_active === 1
    );

    if (!restaurant) {
      return res.status(404).json({ error: "餐廳不存在" });
    }

    // 檢查是否已有偏好記錄
    const existingPreference = proxy.user_restaurant_preference?.find(
      (p: any) =>
        p != null && p.user_id === userId && p.restaurant_id === restaurant_id
    );

    const now = new Date().toISOString();
    const preferenceId = `${userId}_${restaurant_id}_${Date.now()}`;

    if (existingPreference) {
      // 更新現有記錄
      db.prepare(
        `UPDATE user_restaurant_preference 
         SET preference = ?, updated_at = ? 
         WHERE user_id = ? AND restaurant_id = ?`
      ).run(preference, now, userId, restaurant_id);
    } else {
      // 創建新記錄
      db.prepare(
        `INSERT INTO user_restaurant_preference (id, user_id, restaurant_id, preference, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(preferenceId, userId, restaurant_id, preference, now, now);
    }

    // 重新生成 proxy（如果需要）
    // 注意：這裡可能需要重新加載數據，但為了性能，我們先返回成功
    // 實際應用中可能需要使用更好的緩存策略

    res.status(200).json({
      success: true,
      message: preference === "favorite" ? "已收藏" : preference === "like" ? "已添加到喜歡" : "已記錄",
      preference: preference,
    });
  } catch (error) {
    console.error("記錄餐廳偏好失敗:", error);
    res.status(500).json({
      error: "記錄餐廳偏好失敗",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// === 服務器啟動 ===

// 異步初始化函數
async function startServer() {
  try {
    console.log("🔧 開始初始化服務器...");
    console.log("📦 檢查數據庫連接...");
    
    // 檢查數據庫和 proxy 是否正常
    if (!db) {
      throw new Error("數據庫未初始化");
    }
    if (!proxy || !proxy.restaurant) {
      console.warn("⚠️  proxy.restaurant 未初始化，但繼續啟動服務器");
    }
    
    console.log("📦 加載 TensorFlow.js 模塊...");
    // 加載 TensorFlow.js 模塊（如果可用）
    await loadTensorFlowModules();

    // 初始化食物識別模型（如果 TensorFlow.js 可用）
    if (tensorflowAvailable) {
      console.log("🤖 初始化食物識別模型...");
      await initializeFoodRecognitionModels();
    }

    console.log("🚀 啟動 HTTP 服務器...");
    // 啟動服務器
    app.listen(PORT, () => {
      console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
      console.log(`- 靜態資源來源: public 文件夾`);
      console.log(`- API 根路徑: /api`);
      console.log(`- 測試頁面: http://localhost:${PORT}/food-recognition-test.html`);
    });
  } catch (error: any) {
    console.error("❌ 服務器啟動失敗:", error);
    console.error("錯誤詳情:", error?.message || String(error));
    if (error?.stack) {
      console.error("錯誤堆棧:", error.stack);
    }
    // 嘗試輸出錯誤對象的所有屬性
    if (error && typeof error === 'object') {
      try {
        console.error("錯誤對象屬性:", Object.keys(error));
        console.error("錯誤對象值:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      } catch (e) {
        console.error("無法序列化錯誤對象");
      }
    }
    process.exit(1);
  }
}

// 全局錯誤處理
process.on('uncaughtException', (error: any) => {
  console.error("❌ 未捕獲的異常:", error);
  console.error("錯誤詳情:", error?.message || String(error));
  if (error?.stack) {
    console.error("錯誤堆棧:", error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error("❌ 未處理的 Promise 拒絕:", reason);
  console.error("錯誤詳情:", reason?.message || String(reason));
  if (reason?.stack) {
    console.error("錯誤堆棧:", reason.stack);
  }
  process.exit(1);
});

// 啟動服務器
startServer().catch((error: any) => {
  console.error("❌ 服務器啟動異常:", error);
  console.error("錯誤詳情:", error?.message || String(error));
  if (error?.stack) {
    console.error("錯誤堆棧:", error.stack);
  }
  process.exit(1);
});
