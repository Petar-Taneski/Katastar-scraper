import axios from "axios";
import type { ScrapeRequest, ScrapeResponse } from "./types";

// For dev: local FastAPI
// In production: set this via env, e.g. NEXT_PUBLIC_API_BASE
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 1000 * 60 * 10, // allow long scraping
});

export async function postScrape(payload: ScrapeRequest, signal: AbortSignal) {
  // Pass the signal inside the request configuration
  const res = await api.post<ScrapeResponse>("/scrape", payload, { signal });
  return res.data;
}