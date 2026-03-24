const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = `${BASE}/../api`;

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getUsers: () => fetchJson("/users"),
  getProjects: () => fetchJson("/projects"),
  createProject: (data: any) => fetchJson("/projects", { method: "POST", body: JSON.stringify(data) }),
  getProject: (id: number) => fetchJson(`/projects/${id}`),
  updateProject: (id: number, data: any) => fetchJson(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProject: (id: number) => fetchJson(`/projects/${id}`, { method: "DELETE" }),
  getProducts: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJson(`/products${qs}`);
  },
  createProduct: (data: any) => fetchJson("/products", { method: "POST", body: JSON.stringify(data) }),
  getProduct: (id: number) => fetchJson(`/products/${id}`),
  updateProduct: (id: number, data: any) => fetchJson(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProduct: (id: number) => fetchJson(`/products/${id}`, { method: "DELETE" }),
  getComments: (productId: number) => fetchJson(`/products/${productId}/comments`),
  createComment: (productId: number, data: any) => fetchJson(`/products/${productId}/comments`, { method: "POST", body: JSON.stringify(data) }),
  getSessions: () => fetchJson("/sessions"),
  createSession: (data: any) => fetchJson("/sessions", { method: "POST", body: JSON.stringify(data) }),
  updateSession: (id: number, data: any) => fetchJson(`/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSession: (id: number) => fetchJson(`/sessions/${id}`, { method: "DELETE" }),
  getSessionProducts: (id: number) => fetchJson(`/sessions/${id}/products`),
  getWizardProducts: () => fetchJson("/wizard/products"),
  getDashboard: () => fetchJson("/dashboard"),
  getCaptureSessions: () => fetchJson("/capture-sessions"),
  bulkUpdateStatus: (productIds: number[], uploadStatus: string) =>
    fetchJson("/capture-sessions/bulk-status", { method: "PATCH", body: JSON.stringify({ productIds, uploadStatus }) }),
  bulkUpdateProducts: (productIds: number[], updates: Record<string, any>) =>
    fetchJson("/products/bulk-update", { method: "PATCH", body: JSON.stringify({ productIds, updates }) }),
  importExcel: async (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/projects/${projectId}/import`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },
  importPreview: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/import/preview`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json() as Promise<{ sheets: { sheetName: string; brand: string; rowCount: number }[]; detectedSeason: string; filename: string }>;
  },
  getPlannerBlocks: (year?: number) => fetchJson(`/planner/blocks?year=${year || 2026}`),
  createPlannerBlock: (data: any) => fetchJson("/planner/blocks", { method: "POST", body: JSON.stringify(data) }),
  updatePlannerBlock: (id: number, data: any) => fetchJson(`/planner/blocks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePlannerBlock: (id: number) => fetchJson(`/planner/blocks/${id}`, { method: "DELETE" }),
  getRetouchSessions: () => fetchJson("/retouch-sessions"),
  updateRetouchSession: (sessionName: string, data: any) =>
    fetchJson(`/retouch-sessions/${encodeURIComponent(sessionName)}`, { method: "PATCH", body: JSON.stringify(data) }),
  importExecute: async (file: File, selectedSheets: string[], season: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("selectedSheets", JSON.stringify(selectedSheets));
    formData.append("season", season);
    const res = await fetch(`${API_BASE}/import/execute`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json() as Promise<{ results: { sheetName: string; brand: string; projectName: string; imported: number; skipped: number }[] }>;
  },

  getPreProductionProducts: () => fetchJson("/pre-production/products"),
  addPreProductionImage: (data: { productId: number; objectPath: string; fileName: string; imageType?: string }) =>
    fetchJson("/pre-production/images", { method: "POST", body: JSON.stringify(data) }),
  deletePreProductionImage: (id: number) => fetchJson(`/pre-production/images/${id}`, { method: "DELETE" }),
  reviewProduct: (productId: number, decision: "keep" | "reshoot") =>
    fetchJson("/pre-production/review", { method: "POST", body: JSON.stringify({ productId, decision }) }),
  finalizePreProduction: () => fetchJson("/pre-production/finalize", { method: "POST", body: JSON.stringify({}) }),
  requestUploadUrl: (data: { name: string; size: number; contentType: string }) =>
    fetchJson("/storage/uploads/request-url", { method: "POST", body: JSON.stringify(data) }),
  autoPopulateShots: (productIds: number[]) =>
    fetchJson("/pre-production/auto-populate-shots", { method: "POST", body: JSON.stringify({ productIds }) }),
  resolveKeyCodes: (keyCodes: string[]) =>
    fetchJson("/pre-production/resolve-keycodes", { method: "POST", body: JSON.stringify({ keyCodes }) }),
};
