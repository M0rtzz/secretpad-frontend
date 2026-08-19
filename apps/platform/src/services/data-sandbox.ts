import request from 'umi-request';

export type DataSandboxResponse<T = unknown> = {
  status?: { code?: number; msg?: string };
  data?: T;
};

export type DataSandboxRecord = Record<string, any>;

const base = '/api/v1alpha1/data-sandbox';

const get = <T>(path: string, params?: Record<string, any>) =>
  request<DataSandboxResponse<T>>(`${base}${path}`, { method: 'GET', params });

const post = <T>(path: string, data?: Record<string, any>) =>
  request<DataSandboxResponse<T>>(`${base}${path}`, {
    method: 'POST',
    data: data || {},
  });

export const DataSandboxApi = {
  sandboxes: (params?: DataSandboxRecord) =>
    get<DataSandboxRecord[]>('/sandboxes', params),
  createSandbox: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/sandboxes/create', data),
  sandboxAction: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/sandboxes/action', data),
  devToken: (id: string) =>
    post<{ url: string; expiresAt: string }>('/sandboxes/dev-token', { id }),
  snapshots: (sandboxId: string) =>
    get<DataSandboxRecord[]>('/snapshots', { sandboxId }),
  images: () => get<DataSandboxRecord[]>('/images'),
  saveImage: (data: DataSandboxRecord) => post<DataSandboxRecord>('/images/save', data),

  resourceOverview: (ownerId?: string) =>
    get<DataSandboxRecord>('/resources/overview', { ownerId: ownerId || '' }),
  saveQuota: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/resources/quota', data),
  alerts: (status = '') => get<DataSandboxRecord[]>('/resources/alerts', { status }),
  resolveAlert: (id: string) => post('/resources/alerts/resolve', { id }),
  networkAllowlist: (sandboxId = '') =>
    get<DataSandboxRecord[]>('/resources/network/allowlist', { sandboxId }),
  addNetworkAllowlist: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/resources/network/allowlist', data),
  deleteNetworkAllowlist: (id: string) =>
    post('/resources/network/allowlist/delete', { id }),
  limitVerify: (sandboxId: string) =>
    post<DataSandboxRecord>('/operations/limit-verify', { sandboxId }),

  models: (params?: DataSandboxRecord) => get<DataSandboxRecord[]>('/models', params),
  submitModel: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/models/submit', data),
  modelAction: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/models/action', data),
  modelHistory: (id: string) => get<DataSandboxRecord[]>('/models/history', { id }),

  // Z-03 沙箱资源申请与审批
  approvals: (params?: DataSandboxRecord) =>
    get<DataSandboxRecord[]>('/approvals', params),
  approvalDetail: (id: string) => get<DataSandboxRecord>('/approvals/detail', { id }),
  approvalSubmit: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/approvals/submit', data),
  approvalAction: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/approvals/action', data),
  approvalHistory: (id: string) =>
    get<DataSandboxRecord[]>('/approvals/history', { id }),
  approvalConfig: () => get<DataSandboxRecord>('/approvals/config'),

  logs: (params?: DataSandboxRecord) => get<DataSandboxRecord[]>('/logs', params),
  retention: () => get<DataSandboxRecord[]>('/logs/retention'),
  saveRetention: (data: DataSandboxRecord) => post('/logs/retention', data),

  integrations: () => get<DataSandboxRecord>('/integrations'),
  createClient: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/integrations/clients/create', data),
  revokeClient: (id: string) => post('/integrations/clients/revoke', { id }),
  saveWebhook: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/integrations/webhooks/save', data),
  testWebhook: (id: string) =>
    post<DataSandboxRecord>('/integrations/webhooks/test', { id }),
  retryDelivery: (id: string) =>
    post<DataSandboxRecord>('/integrations/deliveries/retry', { id }),
  saveOidc: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/integrations/oidc/save', data),
  testOidc: () => post<DataSandboxRecord>('/integrations/oidc/test'),

  operations: () => get<DataSandboxRecord>('/operations'),
  createBackup: () => post<DataSandboxRecord>('/operations/backups/create'),
  restoreBackup: (id: string) =>
    post<DataSandboxRecord>('/operations/backups/restore', { id }),
  diagnostics: () => post<DataSandboxRecord>('/operations/diagnostics'),
  help: () => get<DataSandboxRecord[]>('/operations/help'),
  createTicket: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/operations/tickets/create', data),
  updateTicket: (data: DataSandboxRecord) =>
    post<DataSandboxRecord>('/operations/tickets/update', data),

  exportLogs: async (params: DataSandboxRecord) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const response = await fetch(`${base}/logs/export?${query}`, {
      credentials: 'include',
      headers: {
        'User-Token': localStorage.getItem('User-Token') || '',
        'Trace-Id': `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
    });
    if (!response.ok) throw new Error(`日志导出失败: HTTP ${response.status}`);
    return response.blob();
  },
};

export const responseData = <T>(response: DataSandboxResponse<T>, fallback: T): T => {
  if (response.status?.code !== 0) {
    throw new Error(response.status?.msg || '请求失败');
  }
  return response.data === undefined ? fallback : response.data;
};
