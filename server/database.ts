// server/database.ts
// PostgreSQL 數據庫連接和操作類

import { Pool, PoolClient } from "pg";

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

export interface Bill {
  id: string;
  name: string;
  date: Date | null;
  location: string | null;
  tip_percentage: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Participant {
  id: string;
  name: string;
  user_id: string | null;
  created_at: Date;
}

export interface BillItem {
  id: string;
  bill_id: string;
  name: string;
  amount: number;
  is_shared: boolean;
  created_at: Date;
}

export interface CalculationResult {
  id: string;
  bill_id: string;
  participant_id: string;
  total_amount: number;
  breakdown: string;
  created_at: Date;
}

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "party_bill_calculator",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "password",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // 測試連接
    this.pool.on("connect", () => {
      console.log("PostgreSQL 數據庫連接成功");
    });

    this.pool.on("error", (err) => {
      console.error("PostgreSQL 數據庫連接錯誤:", err);
    });
  }

  // 獲取連接
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  // 執行查詢
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  // === 用戶相關操作 ===

  async createUser(
    user: Omit<User, "created_at" | "updated_at">
  ): Promise<User> {
    const query = `
      INSERT INTO users (id, username, email, password)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.query(query, [
      user.id,
      user.username,
      user.email,
      user.password,
    ]);
    return result.rows[0];
  }

  async getUserById(id: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE id = $1";
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE email = $1";
    const result = await this.query(query, [email]);
    return result.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE username = $1";
    const result = await this.query(query, [username]);
    return result.rows[0] || null;
  }

  async searchUsers(query: string): Promise<User[]> {
    const searchQuery = `
      SELECT * FROM users 
      WHERE username ILIKE $1 OR email ILIKE $1 OR email ILIKE $2
      ORDER BY username
    `;
    const result = await this.query(searchQuery, [
      `%${query}%`,
      `%${query}%@%`,
    ]);
    return result.rows;
  }

  // === 會話相關操作 ===

  async createSession(
    sessionId: string,
    userId: string,
    expiresAt: Date
  ): Promise<void> {
    const query = `
      INSERT INTO user_sessions (id, user_id, expires_at)
      VALUES ($1, $2, $3)
    `;
    await this.query(query, [sessionId, userId, expiresAt]);
  }

  async validateSession(sessionId: string): Promise<User | null> {
    const query = `
      SELECT u.* FROM users u
      JOIN user_sessions s ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > NOW()
    `;
    const result = await this.query(query, [sessionId]);
    return result.rows[0] || null;
  }

  async destroySession(sessionId: string): Promise<void> {
    const query = "DELETE FROM user_sessions WHERE id = $1";
    await this.query(query, [sessionId]);
  }

  // === 賬單相關操作 ===

  async createBill(
    bill: Omit<Bill, "created_at" | "updated_at">
  ): Promise<Bill> {
    const query = `
      INSERT INTO bills (id, name, date, location, tip_percentage, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await this.query(query, [
      bill.id,
      bill.name,
      bill.date,
      bill.location,
      bill.tip_percentage,
      bill.created_by,
    ]);
    return result.rows[0];
  }

  async getBillById(id: string): Promise<Bill | null> {
    const query = "SELECT * FROM bills WHERE id = $1";
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  async getBillsByUser(userId: string): Promise<Bill[]> {
    const query =
      "SELECT * FROM bills WHERE created_by = $1 ORDER BY created_at DESC";
    const result = await this.query(query, [userId]);
    return result.rows;
  }

  async updateBill(id: string, updates: Partial<Bill>): Promise<Bill | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return await this.getBillById(id);
    }

    const query = `
      UPDATE bills 
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  async deleteBill(id: string): Promise<boolean> {
    const query = "DELETE FROM bills WHERE id = $1";
    const result = await this.query(query, [id]);
    return result.rowCount > 0;
  }

  // === 參與者相關操作 ===

  async createParticipant(
    participant: Omit<Participant, "created_at">
  ): Promise<Participant> {
    const query = `
      INSERT INTO participants (id, name, user_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await this.query(query, [
      participant.id,
      participant.name,
      participant.user_id,
    ]);
    return result.rows[0];
  }

  async getParticipantById(id: string): Promise<Participant | null> {
    const query = "SELECT * FROM participants WHERE id = $1";
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  async addBillParticipant(
    billId: string,
    participantId: string
  ): Promise<void> {
    const query = `
      INSERT INTO bill_participants (bill_id, participant_id)
      VALUES ($1, $2)
      ON CONFLICT (bill_id, participant_id) DO NOTHING
    `;
    await this.query(query, [billId, participantId]);
  }

  async getBillParticipants(billId: string): Promise<Participant[]> {
    const query = `
      SELECT p.* FROM participants p
      JOIN bill_participants bp ON p.id = bp.participant_id
      WHERE bp.bill_id = $1
    `;
    const result = await this.query(query, [billId]);
    return result.rows;
  }

  // === 項目相關操作 ===

  async createBillItem(item: Omit<BillItem, "created_at">): Promise<BillItem> {
    const query = `
      INSERT INTO bill_items (id, bill_id, name, amount, is_shared)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await this.query(query, [
      item.id,
      item.bill_id,
      item.name,
      item.amount,
      item.is_shared,
    ]);
    return result.rows[0];
  }

  async getBillItems(billId: string): Promise<BillItem[]> {
    const query =
      "SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY created_at";
    const result = await this.query(query, [billId]);
    return result.rows;
  }

  async addItemParticipant(
    itemId: string,
    participantId: string
  ): Promise<void> {
    const query = `
      INSERT INTO item_participants (item_id, participant_id)
      VALUES ($1, $2)
      ON CONFLICT (item_id, participant_id) DO NOTHING
    `;
    await this.query(query, [itemId, participantId]);
  }

  async getItemParticipants(itemId: string): Promise<Participant[]> {
    const query = `
      SELECT p.* FROM participants p
      JOIN item_participants ip ON p.id = ip.participant_id
      WHERE ip.item_id = $1
    `;
    const result = await this.query(query, [itemId]);
    return result.rows;
  }

  // === 計算結果相關操作 ===

  async saveCalculationResults(
    results: Omit<CalculationResult, "created_at">[]
  ): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query("BEGIN");

      for (const result of results) {
        const query = `
          INSERT INTO calculation_results (id, bill_id, participant_id, total_amount, breakdown)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            total_amount = EXCLUDED.total_amount,
            breakdown = EXCLUDED.breakdown
        `;
        await client.query(query, [
          result.id,
          result.bill_id,
          result.participant_id,
          result.total_amount,
          result.breakdown,
        ]);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getCalculationResults(billId: string): Promise<CalculationResult[]> {
    const query = `
      SELECT cr.*, p.name as participant_name
      FROM calculation_results cr
      JOIN participants p ON cr.participant_id = p.id
      WHERE cr.bill_id = $1
      ORDER BY p.name
    `;
    const result = await this.query(query, [billId]);
    return result.rows;
  }

  // === 清理操作 ===

  async cleanupExpiredSessions(): Promise<void> {
    const query = "DELETE FROM user_sessions WHERE expires_at < NOW()";
    await this.query(query);
  }

  // 關閉連接池
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// 導出單例實例
export const database = new Database();
