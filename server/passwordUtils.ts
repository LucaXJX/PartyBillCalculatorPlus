import bcrypt from "bcrypt";

/**
 * 密碼安全工具類
 * 使用 bcrypt 進行密碼哈希加密
 */
export class PasswordUtils {
  /**
   * 加密密碼
   * @param password 明文密碼
   * @returns 加密後的密碼哈希
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // 鹽值輪數，越高越安全但越慢
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * 驗證密碼
   * @param password 明文密碼
   * @param hashedPassword 存儲的加密密碼
   * @returns 是否匹配
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * 同步版本的密碼加密（用於向後兼容）
   * @param password 明文密碼
   * @returns 加密後的密碼哈希
   */
  static hashPasswordSync(password: string): string {
    const saltRounds = 12;
    return bcrypt.hashSync(password, saltRounds);
  }

  /**
   * 同步版本的密碼驗證（用於向後兼容）
   * @param password 明文密碼
   * @param hashedPassword 存儲的加密密碼
   * @returns 是否匹配
   */
  static verifyPasswordSync(password: string, hashedPassword: string): boolean {
    return bcrypt.compareSync(password, hashedPassword);
  }
}
