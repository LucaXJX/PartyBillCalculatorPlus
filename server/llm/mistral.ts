/**
 * Mistral AI 客戶端
 */
import { Mistral } from "@mistralai/mistralai";
import { env } from "./env.js";

export let mistral = new Mistral({
  apiKey: env.MISTRAL_AI_API_KEY,
});
