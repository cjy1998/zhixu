import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export default createOpenAICompatible({
  name: "opencode",
  apiKey: process.env.PROVIDER_API_KEY,
  baseURL: process.env.BASE_URL || "",
  includeUsage: true, // Include usage information in streaming responses
});
