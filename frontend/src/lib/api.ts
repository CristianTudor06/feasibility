import { FeasibilityRow, AllocationResult } from '../types';

// Client for the Flask backend. The capability database and saved options live in
// the shared SQLite store; everything else (working specs, UI prefs, chat) stays per-browser.

export interface SavedOption {
  id: string;
  name: string;
  timestamp: string;
  data: FeasibilityRow[];
}

export interface SharedDatabase {
  rows: FeasibilityRow[];
  filename: string | null;
  uploadedAt: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response had no JSON body
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  getDatabase: () => request<SharedDatabase | null>('/api/database'),

  saveDatabase: (rows: FeasibilityRow[], filename: string) =>
    request<SharedDatabase>('/api/database', {
      method: 'PUT',
      body: JSON.stringify({ rows, filename })
    }),

  deleteDatabase: () => request<void>('/api/database', { method: 'DELETE' }),

  listSavedOptions: () => request<SavedOption[]>('/api/saved-options'),

  createSavedOption: (option: SavedOption) =>
    request<SavedOption>('/api/saved-options', {
      method: 'POST',
      body: JSON.stringify(option)
    }),

  updateSavedOption: (option: SavedOption) =>
    request<SavedOption>(`/api/saved-options/${encodeURIComponent(option.id)}`, {
      method: 'PUT',
      body: JSON.stringify(option)
    }),

  deleteSavedOption: (id: string) =>
    request<void>(`/api/saved-options/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  async downloadExcel(pitches: FeasibilityRow[], allocations: AllocationResult[], strategyName: string, filename: string) {
    const res = await fetch('/api/export/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pitches, allocations, strategyName })
    });
    if (!res.ok) {
      throw new Error(`Excel export failed (${res.status} ${res.statusText})`);
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
};
