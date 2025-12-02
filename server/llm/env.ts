/**
 * LLM 環境變數配置
 */
import { config } from "dotenv";
import { populateEnv } from "populate-env";

config({ quiet: true });

export let env = {
  MISTRAL_AI_API_KEY: "",
  MISTRAL_AI_API_URL: "https://api.mistral.ai/v1",
};

populateEnv(env, { mode: "halt" });
