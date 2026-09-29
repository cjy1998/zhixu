import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Result } from "./utils/result.js";
import { generateText } from "ai";
import opencodeProvider from "./utils/modelProvider.js";
import Message from "./constants/Message.js";

const app = new Hono();

app.get("/ai/health", (c) => {
  return Result.success(c, {
    app: "zhixu-ai",
    time: new Date().toISOString(),
  });
});
app.get("/ai/test", async (c) => {
  try {
    const { text } = await generateText({
      model: opencodeProvider("qwen3.8-flash"),
      prompt: "你是什么模型？",
    });
    return Result.success(c, {
      text,
    });
  } catch (error) {
    console.log(error);
    return Result.error(c, Message.INTERNAL_SERVER_ERROR);
  }
});
serve(
  {
    fetch: app.fetch,
    port: 4601,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
