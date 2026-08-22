import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  DataComputeApi,
  DataDevApi,
  DataModelApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';
import { formatTime, MvpPage, RefreshButton } from '@/modules/data-sandbox-mvp/common';

const modelStatusLabels: Record<string, string> = {
  DRAFT: '草稿',
  APPROVING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  PUBLISHED: '已发布',
  OFFLINE: '已下线',
};

const modelStatusColors: Record<string, string> = {
  DRAFT: 'default',
  APPROVING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  PUBLISHED: 'geekblue',
  OFFLINE: 'default',
};

const approvalStatusLabels: Record<string, string> = {
  MODEL_REVIEW: '模型评审',
  RESOURCE_REVIEW: '资源评审',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  PUBLISHED: '已发布',
};

const approvalStatusColors: Record<string, string> = {
  MODEL_REVIEW: 'processing',
  RESOURCE_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  PUBLISHED: 'geekblue',
};

const testStatusLabels: Record<string, string> = {
  RUNNING: '执行中',
  SUCCEEDED: '成功',
  FAILED: '失败',
  CANCELLED: '已取消',
};

const testStatusColors: Record<string, string> = {
  RUNNING: 'processing',
  SUCCEEDED: 'success',
  FAILED: 'error',
  CANCELLED: 'default',
};

const apiStatusLabels: Record<string, string> = {
  ENABLED: '启用',
  DISABLED: '停用',
};

const apiStatusColors: Record<string, string> = {
  ENABLED: 'success',
  DISABLED: 'default',
};

const artifactTypeLabels: Record<string, string> = {
  JAR: 'JAR 制品',
  PYTHON: 'Python 函数',
};

const artifactTypeColors: Record<string, string> = {
  JAR: 'geekblue',
  PYTHON: 'purple',
};

const metricTypeLabels: Record<string, string> = {
  auto: '自动',
  classification: '分类',
  regression: '回归',
};

/** 解析后端返回的 JSON（已解析对象直接透传；字符串则 JSON.parse）。 */
const parseJson = (value: unknown): DataSandboxRecord => {
  if (value && typeof value === 'object') return value as DataSandboxRecord;
  if (typeof value !== 'string' || !value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

/** 指标卡片：分类 accuracy/precision/recall/f1 + 混淆矩阵；回归 mae/rmse/r2。 */
const MetricCards = ({ metrics: metricsRaw }: { metrics: unknown }) => {
  const metrics = parseJson(metricsRaw);
  const keys = [
    ['accuracy', '准确率'],
    ['precision', '精确率'],
    ['recall', '召回率'],
    ['f1', 'F1'],
    ['mae', 'MAE'],
    ['rmse', 'RMSE'],
    ['r2', 'R²'],
  ] as const;
  const items = keys.filter(([k]) => metrics[k] !== undefined);
  const matrix = metrics.confusionMatrix as DataSandboxRecord | undefined;
  return (
    <Space wrap size={8} style={{ margin: '8px 0' }}>
      {items.map(([k, label]) => (
        <Tag key={k} color="blue">
          {label} {Number(metrics[k]).toFixed(4)}
        </Tag>
      ))}
      {matrix && (
        <Tag color="geekblue">
          TP {Number(matrix.tp)} · FP {Number(matrix.fp)} · FN {Number(matrix.fn)} · TN{' '}
          {Number(matrix.tn)}
        </Tag>
      )}
      {!items.length && matrix && <Tag>metrics</Tag>}
    </Space>
  );
};

/** header[] + rows[][] 摘要表。 */
const SummaryTable = ({ summary: summaryRaw }: { summary: unknown }) => {
  const summary = parseJson(summaryRaw);
  const header = (summary.header || []) as string[];
  const rows = (summary.rows || []) as string[][];
  if (!header.length) return null;
  return (
    <Table
      size="small"
      rowKey={(_, i) => String(i)}
      pagination={false}
      scroll={{ x: 'max-content', y: 240 }}
      dataSource={rows.map((r, i) =>
        Object.fromEntries(header.map((h, j) => [h, r[j]])),
      )}
      columns={header.map((h) => ({
        title: h,
        dataIndex: h,
        ellipsis: true,
        width: 120,
      }))}
    />
  );
};

export const ModelCenterComponent = ({ context }: { context?: DataSandboxRecord }) => {
  /* ------------------------------- 模型注册 ------------------------------- */
  const [models, setModels] = useState<DataSandboxRecord[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState('');
  const [modelKeyword, setModelKeyword] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm] = Form.useForm();
  // 注册模型弹窗：所属项目由沙箱上下文自动注入（context.project/sandbox.project_id），无需用户选择
  const [jarArtifacts, setJarArtifacts] = useState<DataSandboxRecord[]>([]);
  const regArtifactId = Form.useWatch('artifactId', registerForm);
  const [regVersions, setRegVersions] = useState<DataSandboxRecord[]>([]);
  const [modelDetailItem, setModelDetailItem] = useState<DataSandboxRecord>();
  const [modelDetailOpen, setModelDetailOpen] = useState(false);

  /* ------------------------------- 审批 ------------------------------- */
  const [approvals, setApprovals] = useState<DataSandboxRecord[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState('');
  const [approvalDetailOpen, setApprovalDetailOpen] = useState(false);
  const [approvalDetailItem, setApprovalDetailItem] = useState<DataSandboxRecord>();
  const [testForm] = Form.useForm();
  const [testRunning, setTestRunning] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  /* ------------------------------- 测试记录 ------------------------------- */
  const [tests, setTests] = useState<DataSandboxRecord[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [testDetailOpen, setTestDetailOpen] = useState(false);
  const [testDetailItem, setTestDetailItem] = useState<DataSandboxRecord>();
  const [testLogOpen, setTestLogOpen] = useState(false);
  const [testLogText, setTestLogText] = useState('');

  /* ------------------------------- API 发布 ------------------------------- */
  const [apis, setApis] = useState<DataSandboxRecord[]>([]);
  const [apisLoading, setApisLoading] = useState(false);
  const [apiCreateOpen, setApiCreateOpen] = useState(false);
  const [apiCreateForm] = Form.useForm();
  const [publishableModels, setPublishableModels] = useState<DataSandboxRecord[]>([]);
  const [apiDetailOpen, setApiDetailOpen] = useState(false);
  const [apiDetailItem, setApiDetailItem] = useState<DataSandboxRecord>();
  const [apiUpdateForm] = Form.useForm();
  /* 从沙箱制品一键发布（自动注册 APPROVED 模型 + 建 API） */
  const [artifactCreateOpen, setArtifactCreateOpen] = useState(false);
  const [artifactCreateForm] = Form.useForm();
  const [artifactCreateArtifacts, setArtifactCreateArtifacts] = useState<
    DataSandboxRecord[]
  >([]);
  const artifactCreateArtifactId = Form.useWatch('artifactId', artifactCreateForm);
  const [artifactCreateVersions, setArtifactCreateVersions] = useState<
    DataSandboxRecord[]
  >([]);
  const [invokeRows, setInvokeRows] = useState('[\n  {"id": 1, "score": 60}\n]');
  const [invokeResult, setInvokeResult] = useState<DataSandboxRecord>();
  const [invokeLoading, setInvokeLoading] = useState(false);

  /* ------------------------------- 数据加载 ------------------------------- */

  const refreshModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      setModels(
        responseData(
          await DataModelApi.models({
            status: modelStatus,
            keyword: modelKeyword,
          }),
          [],
        ),
      );
    } catch (error: any) {
      message.error(error.message || '加载模型失败');
    } finally {
      setModelsLoading(false);
    }
  }, [modelStatus, modelKeyword]);

  const refreshApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      setApprovals(
        responseData(await DataModelApi.approvals({ status: approvalStatus }), []),
      );
    } catch (error: any) {
      message.error(error.message || '加载审批失败');
    } finally {
      setApprovalsLoading(false);
    }
  }, [approvalStatus]);

  const refreshTests = useCallback(async () => {
    setTestsLoading(true);
    try {
      setTests(responseData(await DataModelApi.tests({ status: testStatus }), []));
    } catch (error: any) {
      message.error(error.message || '加载测试失败');
    } finally {
      setTestsLoading(false);
    }
  }, [testStatus]);

  const refreshApis = useCallback(async () => {
    setApisLoading(true);
    try {
      setApis(responseData(await DataModelApi.apis({}), []));
    } catch (error: any) {
      message.error(error.message || '加载 API 失败');
    } finally {
      setApisLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    refreshApprovals();
  }, [refreshApprovals]);

  useEffect(() => {
    refreshTests();
  }, [refreshTests]);

  useEffect(() => {
    refreshApis();
  }, [refreshApis]);

  useEffect(() => {
    if (registerOpen) {
      DataDevApi.artifacts({ type: 'JAR' }).then((res) =>
        setJarArtifacts(
          responseData(res, []).filter((a) => a.type === 'JAR' || a.type === 'PYTHON'),
        ),
      );
    }
  }, [registerOpen]);

  useEffect(() => {
    if (regArtifactId) {
      DataDevApi.versions(regArtifactId).then((res) =>
        setRegVersions(responseData(res, [])),
      );
    } else {
      setRegVersions([]);
    }
  }, [regArtifactId]);

  useEffect(() => {
    if (apiCreateOpen) {
      DataModelApi.models({}).then((res) =>
        setPublishableModels(
          responseData(res, []).filter(
            (m) => m.status === 'APPROVED' || m.status === 'PUBLISHED',
          ),
        ),
      );
    }
  }, [apiCreateOpen]);

  useEffect(() => {
    if (artifactCreateOpen) {
      DataDevApi.artifacts({ type: 'PYTHON' }).then((res) =>
        setArtifactCreateArtifacts(
          responseData(res, []).filter((a) => a.type === 'PYTHON'),
        ),
      );
    }
  }, [artifactCreateOpen]);

  useEffect(() => {
    if (artifactCreateArtifactId) {
      DataDevApi.versions(artifactCreateArtifactId).then((res) =>
        setArtifactCreateVersions(responseData(res, [])),
      );
    } else {
      setArtifactCreateVersions([]);
    }
  }, [artifactCreateArtifactId]);

  /* ------------------------------- 模型操作 ------------------------------- */

  const openRegister = () => {
    registerForm.resetFields();
    setRegisterOpen(true);
  };

  const registerModel = async () => {
    const values = await registerForm.validateFields();
    // 沙箱上下文内项目唯一，无需再让用户选择：取当前沙箱所属项目（兜底保留表单值）
    const projectId =
      context?.project?.project_id || context?.sandbox?.project_id || values.projectId;
    try {
      responseData(
        await DataModelApi.register({
          name: values.name,
          projectId,
          artifactId: values.artifactId,
          artifactVersionId: values.artifactVersionId,
          description: values.description || '',
        }),
        {},
      );
      message.success('模型注册成功（DRAFT），可提交审批');
      setRegisterOpen(false);
      refreshModels();
    } catch (error: any) {
      message.error(error.message || '注册失败');
    }
  };

  const openModelDetail = async (row: DataSandboxRecord) => {
    try {
      const detail = responseData(await DataModelApi.modelDetail(row.id), {});
      setModelDetailItem(detail);
      setModelDetailOpen(true);
    } catch (error: any) {
      message.error(error.message || '加载模型详情失败');
    }
  };

  const submitApproval = async (modelId: string) => {
    try {
      const detail = responseData(
        await DataModelApi.submitApproval({ modelId, comment: '' }),
        {},
      );
      message.success('已提交审批 → 模型评审');
      setModelDetailItem(detail);
      refreshModels();
      refreshApprovals();
    } catch (error: any) {
      message.error(error.message || '提交审批失败');
    }
  };

  const publishAsComponent = async (row: DataSandboxRecord) => {
    try {
      const component = responseData(
        await DataComputeApi.publishComponent({ modelId: row.id, name: row.name }),
        {},
      );
      message.success(`已发布为建模组件：${component.code}`);
    } catch (error: any) {
      message.error(error.message || '发布组件失败');
    }
  };

  const deleteModel = async (row: DataSandboxRecord) => {
    Modal.confirm({
      title: `删除模型 ${row.name}？`,
      content: '仅草稿/已拒绝/已下线模型可删除，删除后不可恢复。',
      onOk: async () => {
        try {
          await DataModelApi.deleteModel(row.id);
          message.success('模型已删除');
          refreshModels();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  /* ------------------------------- 审批操作 ------------------------------- */

  const openApprovalDetail = async (row: DataSandboxRecord) => {
    try {
      const detail = responseData(await DataModelApi.approvalDetail(row.id), {});
      setApprovalDetailItem(detail);
      setApprovalDetailOpen(true);
      testForm.resetFields();
    } catch (error: any) {
      message.error(error.message || '加载审批详情失败');
    }
  };

  const refreshApprovalDetail = async (id: string) => {
    try {
      setApprovalDetailItem(responseData(await DataModelApi.approvalDetail(id), {}));
    } catch (error: any) {
      message.error(error.message || '刷新审批详情失败');
    }
  };

  const approvalAction = async (action: string, comment = '') => {
    const item = approvalDetailItem;
    if (!item) return;
    setActionBusy(true);
    try {
      const detail = responseData(
        await DataModelApi.approvalAction({ id: item.id, action, comment }),
        {},
      );
      message.success(`审批操作 ${action} 成功`);
      setApprovalDetailItem(detail);
      refreshModels();
      refreshApprovals();
    } catch (error: any) {
      message.error(error.message || `操作 ${action} 失败`);
      refreshApprovalDetail(item.id);
    } finally {
      setActionBusy(false);
    }
  };

  const executeTest = async () => {
    const item = approvalDetailItem;
    if (!item) return;
    const values = await testForm.validateFields();
    setTestRunning(true);
    try {
      const test = responseData(
        await DataModelApi.executeTest({
          modelId: item.model_id,
          nodeId: values.nodeId,
          datatableId: values.datatableId,
          labelColumn: values.labelColumn,
          predictionColumn: values.predictionColumn,
          metricType: values.metricType || 'auto',
          params: parseJson(values.params || '{}'),
        }),
        {},
      );
      message.success('测试已提交执行，运行结束后自动收官');
      testForm.resetFields();
      refreshApprovalDetail(item.id);
      refreshTests();
    } catch (error: any) {
      message.error(error.message || '测试执行失败');
    } finally {
      setTestRunning(false);
    }
  };

  const openTestDetail = async (id: string) => {
    try {
      setTestDetailItem(responseData(await DataModelApi.testDetail(id), {}));
      setTestDetailOpen(true);
    } catch (error: any) {
      message.error(error.message || '加载测试详情失败');
    }
  };

  const openTestLog = async (id: string, attempt?: number) => {
    try {
      const log = responseData(await DataModelApi.testLog(id, attempt), {});
      setTestLogText(String(log.logText || '（无日志）'));
      setTestLogOpen(true);
    } catch (error: any) {
      message.error(error.message || '加载日志失败');
    }
  };

  const cancelTest = async (row: DataSandboxRecord) => {
    try {
      responseData(await DataModelApi.cancelTest(row.id), {});
      message.success('测试已取消');
      refreshTests();
      refreshApprovalDetail(approvalDetailItem?.id || '');
    } catch (error: any) {
      message.error(error.message || '取消失败');
    }
  };

  const retryTest = async (row: DataSandboxRecord) => {
    try {
      responseData(await DataModelApi.retryTest(row.id), {});
      message.success('已重试');
      refreshTests();
    } catch (error: any) {
      message.error(error.message || '重试失败');
    }
  };

  /* ------------------------------- API 操作 ------------------------------- */

  const createApi = async () => {
    const values = await apiCreateForm.validateFields();
    try {
      const api = responseData(
        await DataModelApi.createApi({
          modelId: values.modelId,
          name: values.name,
          description: values.description || '',
          authorizedUsers: values.authorizedUsers || [],
          ipWhitelist: values.ipWhitelist || [],
          validFrom: values.validFrom || '',
          validTo: values.validTo || '',
        }),
        {},
      );
      message.success('API 已发布');
      setApiCreateOpen(false);
      refreshApis();
      refreshModels();
      setApiDetailItem(api);
      setApiDetailOpen(true);
    } catch (error: any) {
      message.error(error.message || '发布失败');
    }
  };

  /** 从沙箱制品（PYTHON，选版本）一键发布：自动注册 APPROVED 模型 + 建 API，返回 app_id/app_secret */
  const createApiFromArtifact = async () => {
    const values = await artifactCreateForm.validateFields();
    try {
      const api = responseData(
        await DataModelApi.createApiFromArtifact({
          artifactId: values.artifactId,
          artifactVersionId: values.artifactVersionId,
          name: values.name,
          description: values.description || '',
          // 沙箱上下文自动注入所属项目与沙箱（后端 createFromArtifact 依赖 projectId）
          projectId: context?.project?.project_id || context?.sandbox?.project_id || '',
          sandboxId: context?.sandbox?.id || '',
          authorizedUsers: values.authorizedUsers || [],
          ipWhitelist: values.ipWhitelist || [],
          validFrom: values.validFrom || '',
          validTo: values.validTo || '',
        }),
        {},
      );
      message.success('制品已自动注册模型并发布 API');
      setArtifactCreateOpen(false);
      refreshApis();
      refreshModels();
      setApiDetailItem(api);
      setApiDetailOpen(true);
    } catch (error: any) {
      message.error(error.message || '发布失败');
    }
  };

  const openApiDetail = async (row: DataSandboxRecord) => {
    try {
      setApiDetailItem(responseData(await DataModelApi.apiDetail(row.id), {}));
      setApiDetailOpen(true);
    } catch (error: any) {
      message.error(error.message || '加载 API 详情失败');
    }
  };

  const refreshApiDetail = async (id: string) => {
    try {
      setApiDetailItem(responseData(await DataModelApi.apiDetail(id), {}));
    } catch (error: any) {
      message.error(error.message || '刷新 API 详情失败');
    }
  };

  const updateApi = async () => {
    const item = apiDetailItem;
    if (!item) return;
    const values = await apiUpdateForm.validateFields();
    try {
      const detail = responseData(
        await DataModelApi.updateApi({
          id: item.id,
          name: values.name,
          description: values.description,
          authorizedUsers: values.authorizedUsers || [],
          ipWhitelist: values.ipWhitelist || [],
          validFrom: values.validFrom || '',
          validTo: values.validTo || '',
        }),
        {},
      );
      setApiDetailItem(detail);
      message.success('API 已更新');
      refreshApis();
    } catch (error: any) {
      message.error(error.message || '更新失败');
    }
  };

  const apiToggle = async (row: DataSandboxRecord, enable: boolean) => {
    try {
      await (enable ? DataModelApi.enableApi(row.id) : DataModelApi.disableApi(row.id));
      message.success(enable ? '已启用' : '已停用');
      refreshApis();
      refreshApiDetail(apiDetailItem?.id || '');
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const regenerateSecret = async (row: DataSandboxRecord) => {
    Modal.confirm({
      title: '重发调用密钥？',
      content: '新密钥仅显示一次，旧密钥立即失效。',
      onOk: async () => {
        try {
          const detail = responseData(await DataModelApi.regenerateSecret(row.id), {});
          setApiDetailItem(detail);
          message.success('新密钥已生成');
        } catch (error: any) {
          message.error(error.message || '重发失败');
        }
      },
    });
  };

  const deleteApi = async (row: DataSandboxRecord) => {
    Modal.confirm({
      title: `删除 API ${row.name}？`,
      onOk: async () => {
        try {
          await DataModelApi.deleteApi(row.id);
          message.success('API 已删除');
          setApiDetailOpen(false);
          refreshApis();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const runInvoke = async (useCredential: boolean) => {
    const item = apiDetailItem;
    if (!item) return;
    let rows: unknown;
    try {
      rows = JSON.parse(invokeRows);
    } catch {
      message.warning('rows 必须是合法 JSON 数组');
      return;
    }
    setInvokeLoading(true);
    setInvokeResult(undefined);
    try {
      const payload = { rows, params: parseJson(item.invokeParams || '{}') };
      const result = useCredential
        ? await DataModelApi.invokeWithCredential(item.app_id, item.secret, payload)
        : await DataModelApi.invokeWithToken({ appId: item.app_id, ...payload });
      const data = responseData(result, {});
      setInvokeResult(data);
      refreshApis();
      refreshApiDetail(item.id);
    } catch (error: any) {
      message.error(error.message || '调用失败');
    } finally {
      setInvokeLoading(false);
    }
  };

  /* ------------------------------- 渲染 ------------------------------- */

  const registerColumns = [
    {
      title: '模型',
      dataIndex: 'name',
      render: (v: string, row: DataSandboxRecord) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0 }}
            onClick={() => openModelDetail(row)}
          >
            <strong>{v}</strong>
          </Button>
          <span style={{ color: '#888' }}>{row.id}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'artifact_type',
      render: (v: string) => (
        <Tag color={artifactTypeColors[v]}>{artifactTypeLabels[v] || v || '-'}</Tag>
      ),
    },
    { title: '版本', dataIndex: 'version' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={modelStatusColors[v]}>{modelStatusLabels[v] || v}</Tag>
      ),
    },
    { title: '创建人', dataIndex: 'created_by' },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      render: formatTime,
    },
    {
      title: '操作',
      width: 260,
      render: (_: unknown, row: DataSandboxRecord) => (
        <Space wrap>
          <Button type="link" onClick={() => openModelDetail(row)}>
            详情
          </Button>
          {['DRAFT', 'REJECTED'].includes(row.status) && (
            <Button type="link" onClick={() => submitApproval(row.id)}>
              提交审批
            </Button>
          )}
          {['APPROVED', 'PUBLISHED'].includes(row.status) && (
            <Button type="link" onClick={() => publishAsComponent(row)}>
              发布组件
            </Button>
          )}
          {['DRAFT', 'REJECTED', 'OFFLINE'].includes(row.status) && (
            <Button type="link" danger onClick={() => deleteModel(row)}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const approvalColumns = [
    {
      title: '审批单',
      dataIndex: 'id',
      render: (v: string, row: DataSandboxRecord) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0 }}
            onClick={() => openApprovalDetail(row)}
          >
            <strong>{row.model_display_name || row.model_name}</strong>
          </Button>
          <span style={{ color: '#888' }}>{v}</span>
        </Space>
      ),
    },
    {
      title: '制品',
      dataIndex: 'artifact_name',
      render: (v: string, row: DataSandboxRecord) => (
        <Tag color={artifactTypeColors[row.artifact_type]}>{v || '-'}</Tag>
      ),
    },
    { title: '版本', dataIndex: 'version' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={approvalStatusColors[v]}>{approvalStatusLabels[v] || v}</Tag>
      ),
    },
    { title: '提交人', dataIndex: 'submitter' },
    { title: '审批人', dataIndex: 'reviewer', render: (v: string) => v || '-' },
    { title: '提交时间', dataIndex: 'submitted_at', render: formatTime },
    {
      title: '操作',
      render: (_: unknown, row: DataSandboxRecord) => (
        <Button type="link" onClick={() => openApprovalDetail(row)}>
          审批
        </Button>
      ),
    },
  ];

  const testsColumns = [
    {
      title: '测试',
      dataIndex: 'id',
      render: (v: string, row: DataSandboxRecord) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0 }}
            onClick={() => openTestDetail(row.id)}
          >
            <strong>{row.model_id}</strong>
          </Button>
          <span style={{ color: '#888' }}>{v}</span>
        </Space>
      ),
    },
    { title: '运行模式', dataIndex: 'run_mode', render: (v: string) => v || 'DEV' },
    { title: '类型', dataIndex: 'exec_type' },
    { title: '源表', dataIndex: 'source_datatable_id' },
    {
      title: '指标',
      dataIndex: 'metric_type',
      render: (v: string) => metricTypeLabels[v] || v,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={testStatusColors[v]}>{testStatusLabels[v] || v}</Tag>
      ),
    },
    { title: '完成时间', dataIndex: 'finished_at', render: formatTime },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, row: DataSandboxRecord) => (
        <Space wrap>
          <Button type="link" onClick={() => openTestDetail(row.id)}>
            详情
          </Button>
          <Button type="link" onClick={() => openTestLog(row.id)}>
            日志
          </Button>
          {row.status === 'RUNNING' && (
            <Button type="link" danger onClick={() => cancelTest(row)}>
              取消
            </Button>
          )}
          {row.status === 'FAILED' && (
            <Button type="link" onClick={() => retryTest(row)}>
              重试
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const apiColumns = [
    {
      title: 'API',
      dataIndex: 'name',
      render: (v: string, row: DataSandboxRecord) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0 }} onClick={() => openApiDetail(row)}>
            <strong>{v}</strong>
          </Button>
          <span style={{ color: '#888' }}>{row.app_id}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={apiStatusColors[v]}>{apiStatusLabels[v] || v}</Tag>
      ),
    },
    {
      title: '调用次数',
      dataIndex: 'call_count',
      render: (v: unknown) => Number(v || 0),
    },
    { title: '最近调用', dataIndex: 'last_called_at', render: formatTime },
    {
      title: '有效时间',
      render: (_: unknown, row: DataSandboxRecord) =>
        `${row.valid_from || '-'} ~ ${row.valid_to || '-'}`,
    },
    { title: '创建人', dataIndex: 'created_by' },
    { title: '创建时间', dataIndex: 'created_at', render: formatTime },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, row: DataSandboxRecord) => (
        <Space wrap>
          <Button type="link" onClick={() => openApiDetail(row)}>
            详情
          </Button>
          <Button type="link" onClick={() => apiToggle(row, row.status !== 'ENABLED')}>
            {row.status === 'ENABLED' ? '停用' : '启用'}
          </Button>
          <Button type="link" onClick={() => regenerateSecret(row)}>
            重发密钥
          </Button>
          <Button type="link" danger onClick={() => deleteApi(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const approval = approvalDetailItem;
  const approvalModel = approval?.model as DataSandboxRecord | undefined;
  const detailTests = (approval?.tests || []) as DataSandboxRecord[];
  const apiItem = apiDetailItem;

  return (
    <MvpPage
      title="沙箱智能建模：自定义算法"
      description="将当前沙箱调试成功的 JAR/Python 制品保存为算法，经模型审批后发布为建模组件或受控 API"
      extra={
        <RefreshButton
          loading={modelsLoading || approvalsLoading || testsLoading || apisLoading}
          onClick={() => {
            refreshModels();
            refreshApprovals();
            refreshTests();
            refreshApis();
          }}
        />
      }
    >
      <Tabs
        items={[
          {
            key: 'models',
            label: '模型注册',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={modelStatus}
                    onChange={setModelStatus}
                    style={{ width: 140 }}
                    options={[
                      { value: '', label: '全部状态' },
                      ...Object.entries(modelStatusLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                  <Input.Search
                    placeholder="模型名称 / ID"
                    allowClear
                    onSearch={setModelKeyword}
                    style={{ width: 240 }}
                  />
                  <Button type="primary" onClick={openRegister}>
                    注册模型
                  </Button>
                </Space>
                <Table
                  rowKey="id"
                  loading={modelsLoading}
                  dataSource={models}
                  scroll={{ x: 1000 }}
                  columns={registerColumns}
                />
              </>
            ),
          },
          {
            key: 'approvals',
            label: '模型审批',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={approvalStatus}
                    onChange={setApprovalStatus}
                    style={{ width: 160 }}
                    options={[
                      { value: '', label: '全部状态' },
                      ...Object.entries(approvalStatusLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                  <Typography.Text type="secondary">
                    通过前需至少一次成功测试并保存评估指标（门禁 MODEL_TEST_REQUIRED）
                  </Typography.Text>
                </Space>
                <Table
                  rowKey="id"
                  loading={approvalsLoading}
                  dataSource={approvals}
                  scroll={{ x: 1100 }}
                  columns={approvalColumns}
                />
              </>
            ),
          },
          {
            key: 'tests',
            label: '测试记录',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={testStatus}
                    onChange={setTestStatus}
                    style={{ width: 140 }}
                    options={[
                      { value: '', label: '全部状态' },
                      ...Object.entries(testStatusLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                </Space>
                <Table
                  rowKey="id"
                  loading={testsLoading}
                  dataSource={tests}
                  scroll={{ x: 1100 }}
                  columns={testsColumns}
                />
              </>
            ),
          },
          {
            key: 'apis',
            label: 'API 发布',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary">
                    发布后一次性展示 app_id +
                    secret，凭据调用不受授权用户名单约束；有效时间/IP 白名单可配
                  </Typography.Text>
                  <Button
                    type="primary"
                    onClick={() => {
                      apiCreateForm.resetFields();
                      setApiCreateOpen(true);
                    }}
                  >
                    发布 API
                  </Button>
                  <Button
                    onClick={() => {
                      artifactCreateForm.resetFields();
                      setArtifactCreateOpen(true);
                    }}
                  >
                    从制品发布
                  </Button>
                </Space>
                <Table
                  rowKey="id"
                  loading={apisLoading}
                  dataSource={apis}
                  scroll={{ x: 1100 }}
                  columns={apiColumns}
                />
              </>
            ),
          },
        ]}
      />

      {/* 注册模型 */}
      <Modal
        title="注册模型"
        open={registerOpen}
        onOk={registerModel}
        onCancel={() => setRegisterOpen(false)}
        destroyOnClose
        width={560}
      >
        <Form form={registerForm} layout="vertical">
          <Form.Item
            name="name"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="如：信贷风控评分模型" />
          </Form.Item>
          <Form.Item
            name="artifactId"
            label="计算制品（JAR / Python）"
            rules={[{ required: true, message: '请选择制品' }]}
          >
            <Select
              placeholder="仅 JAR / Python 制品可注册为模型"
              options={jarArtifacts.map((a) => ({
                value: a.id,
                label: `${a.name} · ${artifactTypeLabels[a.type] || a.type}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="artifactVersionId"
            label="制品版本"
            rules={[{ required: true, message: '请选择版本' }]}
          >
            <Select
              placeholder="选择该制品的一个版本"
              options={regVersions.map((v) => ({
                value: v.id,
                label: `v${v.version}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="模型用途、口径等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 模型详情 */}
      <Drawer
        title="模型详情"
        open={modelDetailOpen}
        onClose={() => setModelDetailOpen(false)}
        width={560}
      >
        {modelDetailItem && (
          <>
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                { key: 'name', label: '名称', children: modelDetailItem.name },
                { key: 'id', label: '模型 ID', children: modelDetailItem.id },
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Tag color={modelStatusColors[modelDetailItem.status]}>
                      {modelStatusLabels[modelDetailItem.status] ||
                        modelDetailItem.status}
                    </Tag>
                  ),
                },
                { key: 'project', label: '项目', children: modelDetailItem.project_id },
                {
                  key: 'artifact',
                  label: '制品',
                  children: `${modelDetailItem.artifact_name || '-'} (v${
                    modelDetailItem.artifact_version_no || modelDetailItem.version
                  })`,
                },
                {
                  key: 'node',
                  label: '运行节点',
                  children: modelDetailItem.node_id || '-',
                },
                {
                  key: 'created',
                  label: '创建人',
                  children: modelDetailItem.created_by,
                },
                {
                  key: 'desc',
                  label: '描述',
                  children: modelDetailItem.description || '-',
                },
                {
                  key: 'counts',
                  label: '统计',
                  children: `测试 ${modelDetailItem.testCount ?? 0} · API ${
                    modelDetailItem.apiCount ?? 0
                  }`,
                },
                {
                  key: 'approval',
                  label: '当前审批',
                  children: modelDetailItem.currentApproval
                    ? `${
                        approvalStatusLabels[modelDetailItem.currentApproval.status] ||
                        modelDetailItem.currentApproval.status
                      } · v${modelDetailItem.currentApproval.version} · ${formatTime(
                        modelDetailItem.currentApproval.submitted_at,
                      )}`
                    : '无',
                },
              ]}
            />
            <Space style={{ marginTop: 16 }}>
              {['DRAFT', 'REJECTED'].includes(modelDetailItem.status) && (
                <Button
                  type="primary"
                  onClick={() => submitApproval(modelDetailItem.id)}
                >
                  提交审批
                </Button>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* 审批详情 */}
      <Drawer
        title="模型审批"
        open={approvalDetailOpen}
        onClose={() => setApprovalDetailOpen(false)}
        width={720}
      >
        {approval && (
          <>
            <Descriptions
              column={2}
              size="small"
              bordered
              items={[
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Tag color={approvalStatusColors[approval.status]}>
                      {approvalStatusLabels[approval.status] || approval.status}
                    </Tag>
                  ),
                },
                {
                  key: 'stage',
                  label: '阶段',
                  children: approval.current_stage || '-',
                },
                { key: 'version', label: '版本', children: `v${approval.version}` },
                { key: 'submitter', label: '提交人', children: approval.submitter },
                {
                  key: 'reviewer',
                  label: '审批人',
                  children: approval.reviewer || '-',
                },
                {
                  key: 'submitted',
                  label: '提交时间',
                  children: formatTime(approval.submitted_at),
                },
              ]}
            />
            {approvalModel && (
              <Descriptions
                column={2}
                size="small"
                style={{ marginTop: 12 }}
                items={[
                  { key: 'm', label: '模型', children: approvalModel.name },
                  {
                    key: 's',
                    label: '状态',
                    children: modelStatusLabels[approvalModel.status],
                  },
                  { key: 'p', label: '项目', children: approvalModel.project_id },
                  {
                    key: 'n',
                    label: '运行节点',
                    children: approvalModel.node_id || '-',
                  },
                ]}
              />
            )}

            <Typography.Title level={5} style={{ marginTop: 16 }}>
              测试执行（审批人配置参数与测试数据）
            </Typography.Title>
            <Form form={testForm} layout="inline" style={{ rowGap: 8 }}>
              <Form.Item name="nodeId" label="运行节点" rules={[{ required: true }]}>
                <Input placeholder="alice" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item
                name="datatableId"
                label="测试数据表"
                rules={[{ required: true }]}
              >
                <Input placeholder="数据表 ID" style={{ width: 160 }} />
              </Form.Item>
              <Form.Item name="labelColumn" label="真实列" rules={[{ required: true }]}>
                <Input placeholder="pass" style={{ width: 110 }} />
              </Form.Item>
              <Form.Item
                name="predictionColumn"
                label="预测列"
                rules={[{ required: true }]}
              >
                <Input placeholder="prediction" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="metricType" label="指标" initialValue="auto">
                <Select
                  style={{ width: 110 }}
                  options={Object.entries(metricTypeLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" loading={testRunning} onClick={executeTest}>
                  执行测试
                </Button>
              </Form.Item>
            </Form>
            <Form.Item label="测试参数 JSON（模型自定义参数）" style={{ marginTop: 8 }}>
              <Input.TextArea
                rows={2}
                onChange={(e) => testForm.setFieldValue('params', e.target.value)}
                placeholder={'{"featureColumn": "score"}'}
              />
            </Form.Item>

            {detailTests.length > 0 && (
              <>
                <Typography.Title level={5} style={{ marginTop: 12 }}>
                  测试记录（通过门禁需要 ≥1 次成功测试且有指标）
                </Typography.Title>
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={detailTests}
                  pagination={false}
                  columns={[
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: (v: string) => (
                        <Tag color={testStatusColors[v]}>
                          {testStatusLabels[v] || v}
                        </Tag>
                      ),
                    },
                    { title: '源表', dataIndex: 'source_datatable_id' },
                    {
                      title: '真实/预测',
                      render: (_: unknown, r: DataSandboxRecord) =>
                        `${r.label_column || '-'} / ${r.prediction_column || '-'}`,
                    },
                    {
                      title: '指标',
                      dataIndex: 'metrics',
                      render: (v: unknown) => (
                        <MetricCards metrics={v as DataSandboxRecord} />
                      ),
                    },
                    {
                      title: '操作',
                      render: (_: unknown, r: DataSandboxRecord) => (
                        <Button type="link" onClick={() => openTestDetail(r.id)}>
                          查看
                        </Button>
                      ),
                    },
                  ]}
                />
              </>
            )}

            <Typography.Title level={5} style={{ marginTop: 12 }}>
              审批历史
            </Typography.Title>
            <Timeline
              items={(approval.history || []).map((h: DataSandboxRecord) => ({
                children: `${h.action}：${h.from_status || '-'} → ${
                  h.to_status || '-'
                } · ${h.reviewer || h.submitter || '-'} · ${formatTime(h.created_at)}${
                  h.comment ? ` · ${h.comment}` : ''
                }`,
              }))}
            />

            <Space style={{ marginTop: 16 }} wrap>
              {['MODEL_REVIEW', 'RESOURCE_REVIEW'].includes(approval.status) && (
                <Button
                  type="primary"
                  loading={actionBusy}
                  onClick={() => approvalAction('APPROVE')}
                >
                  通过
                </Button>
              )}
              {['MODEL_REVIEW', 'RESOURCE_REVIEW'].includes(approval.status) && (
                <Button
                  danger
                  loading={actionBusy}
                  onClick={() => approvalAction('REJECT')}
                >
                  拒绝
                </Button>
              )}
              {approval.status === 'REJECTED' && (
                <Button loading={actionBusy} onClick={() => approvalAction('RESUBMIT')}>
                  重新提交
                </Button>
              )}
              {approval.status === 'APPROVED' && (
                <Button
                  type="primary"
                  loading={actionBusy}
                  onClick={() => approvalAction('PUBLISH')}
                >
                  发布
                </Button>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* 测试详情 */}
      <Drawer
        title="测试详情"
        open={testDetailOpen}
        onClose={() => setTestDetailOpen(false)}
        width={720}
      >
        {testDetailItem && (
          <>
            <Descriptions
              column={2}
              size="small"
              bordered
              items={[
                {
                  key: 's',
                  label: '状态',
                  children: (
                    <Tag color={testStatusColors[testDetailItem.status]}>
                      {testStatusLabels[testDetailItem.status] || testDetailItem.status}
                    </Tag>
                  ),
                },
                { key: 'm', label: '模型', children: testDetailItem.model_id },
                {
                  key: 't',
                  label: '任务',
                  children: testDetailItem.task?.id || testDetailItem.task_id,
                },
                {
                  key: 'r',
                  label: '运行模式',
                  children: testDetailItem.run_mode || 'DEV',
                },
                {
                  key: 'src',
                  label: '源表',
                  children: `${testDetailItem.source_datatable_id}`,
                },
                {
                  key: 'cols',
                  label: '真实/预测',
                  children: `${testDetailItem.label_column || '-'} / ${
                    testDetailItem.prediction_column || '-'
                  }`,
                },
                {
                  key: 'mt',
                  label: '指标类型',
                  children:
                    metricTypeLabels[testDetailItem.metric_type] ||
                    testDetailItem.metric_type,
                },
                {
                  key: 'err',
                  label: '错误',
                  children: testDetailItem.error_message || '-',
                },
              ]}
            />
            <Typography.Title level={5} style={{ marginTop: 12 }}>
              评估指标
            </Typography.Title>
            <MetricCards metrics={testDetailItem.metrics as DataSandboxRecord} />
            <Typography.Title level={5} style={{ marginTop: 12 }}>
              输入摘要（{testDetailItem.inputSummary?.rowCount ?? '-'} 行）
            </Typography.Title>
            <SummaryTable summary={testDetailItem.inputSummary as DataSandboxRecord} />
            <Typography.Title level={5} style={{ marginTop: 12 }}>
              输出摘要（{testDetailItem.outputSummary?.rowCount ?? '-'} 行）
            </Typography.Title>
            <SummaryTable summary={testDetailItem.outputSummary as DataSandboxRecord} />
            <Typography.Title level={5} style={{ marginTop: 12 }}>
              结果预览
            </Typography.Title>
            <SummaryTable summary={parseJson(testDetailItem.result_preview)} />
            <Space style={{ marginTop: 12 }}>
              <Button onClick={() => openTestLog(testDetailItem.id)}>
                查看调试日志
              </Button>
              {testDetailItem.status === 'RUNNING' && (
                <Button danger onClick={() => cancelTest(testDetailItem)}>
                  取消
                </Button>
              )}
              {testDetailItem.status === 'FAILED' && (
                <Button onClick={() => retryTest(testDetailItem)}>重试</Button>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* 调试日志 */}
      <Modal
        title="测试调试日志"
        open={testLogOpen}
        onCancel={() => setTestLogOpen(false)}
        footer={null}
        width={760}
      >
        <pre
          style={{
            background: '#0b0e14',
            color: '#d4d4d4',
            padding: 12,
            maxHeight: 480,
            overflow: 'auto',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {testLogText}
        </pre>
      </Modal>

      {/* 发布 API */}
      <Modal
        title="发布模型为受控 API"
        open={apiCreateOpen}
        onOk={createApi}
        onCancel={() => setApiCreateOpen(false)}
        destroyOnClose
        width={560}
      >
        <Form form={apiCreateForm} layout="vertical">
          <Form.Item
            name="modelId"
            label="模型（已通过审批）"
            rules={[{ required: true, message: '请选择模型' }]}
          >
            <Select
              placeholder="仅已通过（APPROVED/PUBLISHED）的模型可发布"
              options={publishableModels.map((m) => ({
                value: m.id,
                label: `${m.name} · v${m.version} · ${modelStatusLabels[m.status]}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="API 名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：信贷评分服务" />
          </Form.Item>
          <Form.Item name="authorizedUsers" label="授权用户（空=仅凭据调用）">
            <Select mode="tags" placeholder="输入用户名后回车，如 bob" open={false} />
          </Form.Item>
          <Form.Item name="ipWhitelist" label="IP 白名单（空=任意 IP；支持 CIDR）">
            <Select mode="tags" placeholder="如 10.0.0.0/8、1.2.3.4" open={false} />
          </Form.Item>
          <Form.Item name="validFrom" label="生效时间（yyyy-MM-dd HH:mm:ss，空=不限）">
            <Input placeholder="2026-08-01 00:00:00" />
          </Form.Item>
          <Form.Item name="validTo" label="失效时间（yyyy-MM-dd HH:mm:ss，空=不限）">
            <Input placeholder="2026-12-31 23:59:59" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 从沙箱制品一键发布 API */}
      <Modal
        title="从沙箱制品一键发布 API"
        open={artifactCreateOpen}
        onOk={createApiFromArtifact}
        onCancel={() => setArtifactCreateOpen(false)}
        destroyOnClose
        width={560}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          选择 PYTHON 制品 + 版本，系统将自动注册 APPROVED 模型并创建受控 API
          （app_id/app_secret 一次性返回）
        </Typography.Paragraph>
        <Form form={artifactCreateForm} layout="vertical">
          <Form.Item
            name="artifactId"
            label="沙箱制品（PYTHON）"
            rules={[{ required: true, message: '请选择制品' }]}
          >
            <Select
              placeholder="选择 PYTHON 制品（如画布训练自动产物）"
              options={artifactCreateArtifacts.map((a) => ({
                value: a.id,
                label: `${a.name} · ${a.type}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="artifactVersionId"
            label="制品版本"
            rules={[{ required: true, message: '请选择版本' }]}
          >
            <Select
              placeholder="选择该制品的一个版本"
              options={artifactCreateVersions.map((v) => ({
                value: v.id,
                label: `v${v.version} · ${v.created_at || ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="API 名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：信贷评分服务（制品）" />
          </Form.Item>
          <Form.Item name="authorizedUsers" label="授权用户（空=仅凭据调用）">
            <Select mode="tags" placeholder="输入用户名后回车，如 bob" open={false} />
          </Form.Item>
          <Form.Item name="ipWhitelist" label="IP 白名单（空=任意 IP；支持 CIDR）">
            <Select mode="tags" placeholder="如 10.0.0.0/8、1.2.3.4" open={false} />
          </Form.Item>
          <Form.Item name="validFrom" label="生效时间（yyyy-MM-dd HH:mm:ss，空=不限）">
            <Input placeholder="2026-08-01 00:00:00" />
          </Form.Item>
          <Form.Item name="validTo" label="失效时间（yyyy-MM-dd HH:mm:ss，空=不限）">
            <Input placeholder="2026-12-31 23:59:59" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* API 详情 */}
      <Drawer
        title="API 详情"
        open={apiDetailOpen}
        onClose={() => setApiDetailOpen(false)}
        width={720}
      >
        {apiItem && (
          <>
            <Descriptions
              column={2}
              size="small"
              bordered
              items={[
                { key: 'name', label: '名称', children: apiItem.name },
                {
                  key: 'app',
                  label: 'App ID',
                  children: (
                    <Typography.Text copyable>{apiItem.app_id}</Typography.Text>
                  ),
                },
                {
                  key: 'secret',
                  label: '调用密钥',
                  children: apiItem.secret ? (
                    <Typography.Text copyable code>
                      {' '}
                      {apiItem.secret}
                    </Typography.Text>
                  ) : (
                    <span style={{ color: '#888' }}>已隐藏（发布/重发时展示一次）</span>
                  ),
                },
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Tag color={apiStatusColors[apiItem.status]}>
                      {apiStatusLabels[apiItem.status] || apiItem.status}
                    </Tag>
                  ),
                },
                { key: 'calls', label: '调用次数', children: apiItem.call_count },
                {
                  key: 'valid',
                  label: '有效时间',
                  children: `${apiItem.valid_from || '-'} ~ ${apiItem.valid_to || '-'}`,
                },
                {
                  key: 'ip',
                  label: 'IP 白名单',
                  children: Array.isArray(apiItem.ip_whitelist)
                    ? apiItem.ip_whitelist.join(', ') || '任意 IP'
                    : apiItem.ip_whitelist || '任意 IP',
                },
                {
                  key: 'users',
                  label: '授权用户',
                  children: Array.isArray(apiItem.authorized_users)
                    ? apiItem.authorized_users.join(', ') || '仅凭据调用'
                    : apiItem.authorized_users || '仅凭据调用',
                },
              ]}
            />
            <Typography.Title level={5} style={{ marginTop: 12 }}>
              调用测试控制台
            </Typography.Title>
            <Input.TextArea
              rows={5}
              value={invokeRows}
              onChange={(e) => setInvokeRows(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              placeholder={
                '请求体 rows 数组：[{"id":1,"score":60},{"id":2,"score":80}]'
              }
            />
            <Space style={{ marginTop: 8 }}>
              <Button
                type="primary"
                loading={invokeLoading}
                onClick={() => runInvoke(!!apiItem.secret)}
                disabled={!apiItem.app_id}
              >
                调用（{apiItem.secret ? '凭据 X-APP-ID/SECRET' : 'User-Token'}）
              </Button>
              {apiItem.status === 'ENABLED' ? (
                <Button onClick={() => apiToggle(apiItem, false)}>停用</Button>
              ) : (
                <Button type="primary" onClick={() => apiToggle(apiItem, true)}>
                  启用
                </Button>
              )}
              <Button onClick={() => regenerateSecret(apiItem)}>重发密钥</Button>
              <Button danger onClick={() => deleteApi(apiItem)}>
                删除
              </Button>
            </Space>
            {invokeResult && (
              <>
                <Typography.Title level={5} style={{ marginTop: 12 }}>
                  调用结果（{invokeResult.resultRows ?? 0} 行 ·{' '}
                  {invokeResult.elapsedMs ?? 0}ms）
                </Typography.Title>
                <Table
                  size="small"
                  rowKey={(_, i) => String(i)}
                  pagination={false}
                  scroll={{ x: 'max-content', y: 260 }}
                  dataSource={(invokeResult.rows || []).map((r: string[], i: number) =>
                    Object.fromEntries(
                      ((invokeResult.header || []) as string[]).map((h, j) => [
                        h,
                        r[j],
                      ]),
                    ),
                  )}
                  columns={((invokeResult.header || []) as string[]).map((h) => ({
                    title: h,
                    dataIndex: h,
                    ellipsis: true,
                    width: 120,
                  }))}
                />
              </>
            )}
            <Typography.Title level={5} style={{ marginTop: 12 }}>
              授权/白名单设置
            </Typography.Title>
            <Form form={apiUpdateForm} layout="vertical">
              <Form.Item
                name="authorizedUsers"
                label="授权用户（空=仅凭据调用；凭证调用者不受约束）"
                initialValue={
                  Array.isArray(apiItem.authorized_users)
                    ? apiItem.authorized_users
                    : []
                }
              >
                <Select mode="tags" placeholder="输入用户名后回车" open={false} />
              </Form.Item>
              <Form.Item
                name="ipWhitelist"
                label="IP 白名单（空=任意 IP）"
                initialValue={
                  Array.isArray(apiItem.ip_whitelist) ? apiItem.ip_whitelist : []
                }
              >
                <Select mode="tags" placeholder="IP 或 CIDR" open={false} />
              </Form.Item>
              <Form.Item
                name="validFrom"
                label="生效时间"
                initialValue={apiItem.valid_from || ''}
              >
                <Input placeholder="yyyy-MM-dd HH:mm:ss" />
              </Form.Item>
              <Form.Item
                name="validTo"
                label="失效时间"
                initialValue={apiItem.valid_to || ''}
              >
                <Input placeholder="yyyy-MM-dd HH:mm:ss" />
              </Form.Item>
              <Form.Item
                name="description"
                label="描述"
                initialValue={apiItem.description || ''}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
              <Button type="primary" onClick={updateApi}>
                保存设置
              </Button>
            </Form>
          </>
        )}
      </Drawer>
    </MvpPage>
  );
};
