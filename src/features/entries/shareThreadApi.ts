import { invoke } from "@tauri-apps/api/core";

export type ShareThread = {
  token: string;
  entry_ids: string[];
  context_note?: string;
  created_at: string;
  expires_at: string;
  revoked_at?: string;
};

export async function createShareThread(input: {
  entryIds: string[];
  contextNote?: string;
  expiresInDays?: number;
}): Promise<ShareThread> {
  return invoke<ShareThread>("create_share_thread", {
    input: {
      entryIds: input.entryIds,
      contextNote: input.contextNote ?? null,
      expiresInDays: input.expiresInDays ?? 14,
    },
  });
}

export async function getShareThread(token: string): Promise<ShareThread | null> {
  return invoke<ShareThread | null>("get_share_thread", { token });
}

export async function listShareThreads(): Promise<ShareThread[]> {
  return invoke<ShareThread[]>("list_share_threads");
}

export async function revokeShareThread(token: string): Promise<void> {
  return invoke("revoke_share_thread", { token });
}

export async function writeUtf8File(path: string, contents: string): Promise<void> {
  return invoke("write_utf8_file", { path, contents });
}
