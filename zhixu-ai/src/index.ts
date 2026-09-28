import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Result } from "./utils/result.js";

const app = new Hono();

app.get("/ai/health", (c) => {
  return Result.success(c, {
    app: "zhixu-ai",
    time: new Date().toISOString(),
  });
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
