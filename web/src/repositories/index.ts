import { isSupabaseConfigured } from "../lib/supabaseClient";
import { createLocalRepository } from "./localRepository";
import type { CopulaRepository } from "./repository";
import { createSupabaseRepository } from "./supabaseRepository";

let repository: CopulaRepository | null = null;

export function getCopulaRepository() {
  if (repository) {
    return repository;
  }

  if (import.meta.env.VITE_DATA_BACKEND === "supabase" && isSupabaseConfigured()) {
    repository = createSupabaseRepository();
    return repository;
  }

  repository = createLocalRepository();
  return repository;
}

