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

// Z-04 数据治理（抽样/脱敏）：独立前缀 /api/v1alpha1/data-governance
const governanceBase = '/api/v1alpha1/data-governance';

const governanceGet = <T>(path: string, params?: Record<string, any>) =>
  request<DataSandboxResponse<T>>(`${governanceBase}${path}`, {
    method: 'GET',
    params,
  });

const governancePost = <T>(path: string, data?: Record<string, any>) =>
  request<DataSandboxResponse<T>>(`${governanceBase}${path}`, {
    method: 'POST',
    data: data || {},
  });

export const DataGovernanceApi = {
  // 策略
  policies: (params?: DataSandboxRecord) =>
    governanceGet<DataSandboxRecord[]>('/policies', params),
  policyDetail: (id: string) =>
    governanceGet<DataSandboxRecord>('/policies/detail', { id }),
  createPolicy: (data: DataSandboxRecord) =>
    governancePost<DataSandboxRecord>('/policies', data),
  updatePolicy: (data: DataSandboxRecord) =>
    governancePost<DataSandboxRecord>('/policies/update', data),
  deletePolicy: (id: string) => governancePost('/policies/delete', { id }),
  // 任务
  tasks: (params?: DataSandboxRecord) =>
    governanceGet<DataSandboxRecord[]>('/tasks', params),
  taskDetail: (id: string) => governanceGet<DataSandboxRecord>('/tasks/detail', { id }),
  submitTask: (data: DataSandboxRecord) =>
    governancePost<DataSandboxRecord>('/tasks/submit', data),
  cancelTask: (id: string) => governancePost('/tasks/cancel', { id }),
  retryTask: (id: string) => governancePost<DataSandboxRecord>('/tasks/retry', { id }),
  // 结果数据集
  results: (nodeId = '') =>
    governanceGet<DataSandboxRecord[]>('/tasks/results', { nodeId }),
  mountResult: (data: DataSandboxRecord) =>
    governancePost<DataSandboxRecord>('/tasks/mount', data),
  // 结果数据展示（仅脱敏后结果可返回行数据；表头携带数据源）
  viewResult: (taskId: string) =>
    governanceGet<DataSandboxRecord>('/tasks/results/view', { taskId }),
  // 血缘 / 预览
  lineage: (nodeId = '', datatableId = '') =>
    governanceGet<DataSandboxRecord[]>('/lineage', { nodeId, datatableId }),
  preview: (nodeId: string, datatableId: string, limit = 20) =>
    governanceGet<DataSandboxRecord>('/preview', { nodeId, datatableId, limit }),
};

// Z-05 数据开发（JAR/SQL/Python 计算任务）：独立前缀 /api/v1alpha1/data-dev
const devBase = '/api/v1alpha1/data-dev';

const devGet = <T>(path: string, params?: Record<string, any>) =>
  request<DataSandboxResponse<T>>(`${devBase}${path}`, { method: 'GET', params });

const devPost = <T>(path: string, data?: Record<string, any>) =>
  request<DataSandboxResponse<T>>(`${devBase}${path}`, {
    method: 'POST',
    data: data || {},
  });

const devUpload = <T>(
  path: string,
  formData: FormData,
  onUploadProgress?: (percent: number) => void,
) =>
  request<DataSandboxResponse<T>>(`${devBase}${path}`, {
    method: 'POST',
    data: formData,
    ...(onUploadProgress ? { onUploadProgress } : {}),
  });

export const DataDevApi = {
  // 制品
  artifacts: (params?: DataSandboxRecord) =>
    devGet<DataSandboxRecord[]>('/artifacts', params),
  artifactDetail: (id: string) =>
    devGet<DataSandboxRecord>('/artifacts/detail', { id }),
  createArtifact: (data: DataSandboxRecord) =>
    devPost<DataSandboxRecord>('/artifacts', data),
  updateArtifact: (data: DataSandboxRecord) =>
    devPost<DataSandboxRecord>('/artifacts/update', data),
  deleteArtifact: (id: string) => devPost('/artifacts/delete', { id }),
  // 版本
  createVersion: (data: DataSandboxRecord) =>
    devPost<DataSandboxRecord>('/artifacts/versions', data),
  uploadJarVersion: (
    artifactId: string,
    file: File,
    meta: DataSandboxRecord,
    onUploadProgress?: (percent: number) => void,
  ) => {
    const formData = new FormData();
    formData.append('artifactId', artifactId);
    formData.append('file', file);
    formData.append('paramsSchema', meta.paramsSchema || '[]');
    formData.append('defaultParams', meta.defaultParams || '{}');
    formData.append('description', meta.description || '');
    return devUpload<DataSandboxRecord>(
      '/artifacts/versions/upload',
      formData,
      onUploadProgress,
    );
  },
  deleteVersion: (id: string) => devPost('/artifacts/versions/delete', { id }),
  versions: (artifactId: string) =>
    devGet<DataSandboxRecord[]>('/artifacts/versions', { artifactId }),
  versionDetail: (versionId: string) =>
    devGet<DataSandboxRecord>('/artifacts/versions/detail', { versionId }),
  downloadJar: async (versionId: string) => {
    const query = new URLSearchParams({ versionId });
    const response = await fetch(`${devBase}/artifacts/versions/download?${query}`, {
      credentials: 'include',
      headers: {
        'User-Token': localStorage.getItem('User-Token') || '',
        'Trace-Id': `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
    });
    if (!response.ok) throw new Error(`JAR 下载失败: HTTP ${response.status}`);
    return response.blob();
  },
  // 依赖白名单
  dependencies: (params?: DataSandboxRecord) =>
    devGet<DataSandboxRecord[]>('/dependencies', params),
  createDependency: (data: DataSandboxRecord) =>
    devPost<DataSandboxRecord>('/dependencies', data),
  updateDependency: (data: DataSandboxRecord) =>
    devPost<DataSandboxRecord>('/dependencies/update', data),
  deleteDependency: (id: string) => devPost('/dependencies/delete', { id }),
  // 任务
  tasks: (params?: DataSandboxRecord) => devGet<DataSandboxRecord[]>('/tasks', params),
  taskDetail: (id: string) => devGet<DataSandboxRecord>('/tasks/detail', { id }),
  submitTask: (data: DataSandboxRecord) =>
    devPost<DataSandboxRecord>('/tasks/submit', data),
  cancelTask: (id: string) => devPost('/tasks/cancel', { id }),
  retryTask: (id: string) => devPost<DataSandboxRecord>('/tasks/retry', { id }),
  previewSource: (nodeId: string, datatableId: string, limit = 20) =>
    devGet<DataSandboxRecord>('/tasks/preview-source', { nodeId, datatableId, limit }),
  results: (nodeId = '') => devGet<DataSandboxRecord[]>('/tasks/results', { nodeId }),
  viewResult: (taskId: string) =>
    devGet<DataSandboxRecord>('/tasks/results/view', { taskId }),
  runLog: (taskId: string, attempt?: number) =>
    devGet<DataSandboxRecord>('/tasks/log', { taskId, attempt }),
  mountResult: (data: DataSandboxRecord) =>
    devPost<DataSandboxRecord>('/tasks/mount', data),
};

export const responseData = <T>(response: DataSandboxResponse<T>, fallback: T): T => {
  if (response.status?.code !== 0) {
    throw new Error(response.status?.msg || '请求失败');
  }
  return response.data === undefined ? fallback : response.data;
};
