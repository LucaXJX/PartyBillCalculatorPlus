/**
 * 食物識別環境變數配置
 */
import { config } from "dotenv";
import { populateEnv } from "populate-env";

config({ quiet: true });

export let env = {
  BAIDU_API_KEY: "",
  BAIDU_SECRET_KEY: "",
  BAIDU_DISH_RECOGNITION_URL: "https://aip.baidubce.com/rest/2.0/image-classify/v2/dish",
};

populateEnv(env, { mode: "halt" });

