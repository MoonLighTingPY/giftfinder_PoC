// src/services/llamaService.js
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import process from "process";

dotenv.config();

// Resolve model path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODEL_PATH = path.resolve(
  __dirname,
  "../models",
  path.basename(process.env.VITE_LLAMA_MODEL_PATH)
);

let session = null;

/**
 * Initialize local LLM (called at module load)
 */
const initializeLlm = async () => {
  if (process.env.VITE_USE_LOCAL_LLM !== "true") {
    console.log("⏭️ Local LLM disabled by VITE_USE_LOCAL_LLM");
    return;
  }

  if (!fs.existsSync(MODEL_PATH)) {
    console.error("❌ Model file not found:", MODEL_PATH);
    return;
  }

  try {
    console.log("🤖 Loading Llama via getLlama()");
    const llama = await getLlama();
    const model = await llama.loadModel({ modelPath: MODEL_PATH });
    const context = await model.createContext();
    session = new LlamaChatSession({ contextSequence: context.getSequence() });
    console.log("✅ LLM initialized successfully");
  } catch (err) {
    console.error("❌ Failed to initialize LLM:", err);
  }
};

// Immediately kick off initialization
await initializeLlm();

/**
 * Generate a completion using the local LLM
 */
export const generateCompletion = async (prompt, options = {}) => {
  if (!session) throw new Error("LLM not initialized");
  return session.prompt(prompt, options);
};

/**
 * Wrap system + user messages in Mistral Instruct format
 */
export const formatMistralPrompt = (systemMessage, userMessage) => {
  if (systemMessage?.trim()) {
    return `<s>[INST] ${systemMessage}\n\n${userMessage} [/INST]\n`;
  }
  return `<s>[INST] ${userMessage} [/INST]\n`;
};