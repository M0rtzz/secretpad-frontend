import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Upload,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { DataDevApi, DataSandboxRecord, responseData } from '@/services/data-sandbox';
import { listP2PProject } from '@/services/secretpad/P2PProjectController';
import { formatTime, MvpPage, RefreshButton } from '@/modules/data-sandbox-mvp/common';

const artifactTypeLabels: Record<string, string> = {
  JAR: 'JAR 制品',
  SQL: 'SQL 脚本',
  PYTHON: 'Python 函数',
};

const artifactTypeColors: Record<string, string> = {
  JAR: 'geekblue',
  SQL: 'blue',
  PYTHON: 'purple',
};

const execTypeLabels: Record<string, string> = {
  JAR: 'JAR',
  SQL: 'SQL',
  PYTHON: 'Python',
};

const runModeLabels: Record<string, string> = {
  DEV: '开发调试',
  PROD: '正式运行',
};

const statusLabels: Record<string, string> = {
  PENDING: '待执行',
  RUNNING: '执行中',
  SUCCEEDED: '成功',
  FAILED: '失败',
  CANCELLED: '已取消',
};

const statusColors: Record<string, string> = {
  PENDING: 'default',
  RUNNING: 'processing',
  SUCCEEDED: 'success',
  FAILED: 'error',
  CANCELLED: 'default',
};

const CANCELLABLE = ['PENDING', 'RUNNING'];

/** 解析后端返回的 JSON 字符串预览（header/rows）。 */
const parsePreview = (value: unknown) => {
  if (typeof value !== 'string' || !value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

/** 渲染 header[] + rows[][] 预览表。 */
const renderPreviewTable = (preview: DataSandboxRecord) => {
  const header = (preview.header || []) as string[];
  const rows = (preview.rows || []) as string[][];
  if (!header.length) return null;
  return (
    <div style={{ margin: '8px 0' }}>
      <Space wrap size={4} style={{ marginBottom: 8 }}>
        <Tag>行数 {preview.sourceRows ?? rows.length}</Tag>
        <Tag>表头 {header.join(', ')}</Tag>
      </Space>
      <Table
        size="small"
        rowKey={(_, i) => String(i)}
        pagination={false}
        scroll={{ x: 'max-content', y: 360 }}
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
    </div>
  );
};

export const DataDevComponent = () => {
  /* --------------------------------- 制品 --------------------------------- */
  const [artifacts, setArtifacts] = useState<DataSandboxRecord[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactType, setArtifactType] = useState('');
  const [artifactKeyword, setArtifactKeyword] = useState('');
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [artifactItem, setArtifactItem] = useState<DataSandboxRecord>();
  const [artifactForm] = Form.useForm();
  /* 脚本版本（SQL/PYTHON） */
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionArtifact, setVersionArtifact] = useState<DataSandboxRecord>();
  const [versionContent, setVersionContent] = useState('');
  const [scriptForm] = Form.useForm();
  /* JAR 上传 */
  const [jarOpen, setJarOpen] = useState(false);
  const [jarArtifactId, setJarArtifactId] = useState('');
  const [jarFile, setJarFile] = useState<File>();
  const [jarForm] = Form.useForm();
  /* 版本列表 */
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsItem, setVersionsItem] = useState<DataSandboxRecord>();
  const [versions, setVersions] = useState<DataSandboxRecord[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  /* --------------------------------- 任务 --------------------------------- */
  const [tasks, setTasks] = useState<DataSandboxRecord[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState('');
  const [taskRunMode, setTaskRunMode] = useState('');
  const [taskExecType, setTaskExecType] = useState('');
  const [taskKeyword, setTaskKeyword] = useState('');
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm] = Form.useForm();
  const taskExec = Form.useWatch('execType', taskForm);
  const taskSource = Form.useWatch('source', taskForm);
  const taskArtifactId = Form.useWatch('artifactId', taskForm);
  const [preview, setPreview] = useState<DataSandboxRecord>();
  const [allArtifacts, setAllArtifacts] = useState<DataSandboxRecord[]>([]);
  const [artifactVersions, setArtifactVersions] = useState<DataSandboxRecord[]>([]);
  const [deps, setDeps] = useState<DataSandboxRecord[]>([]);

  /* ------------------------------- 详情 / 日志 / 结果 ------------------------------- */
  const [detailItem, setDetailItem] = useState<DataSandboxRecord>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [logItem, setLogItem] = useState<DataSandboxRecord>();
  const [logOpen, setLogOpen] = useState(false);
  const [logDetail, setLogDetail] = useState<DataSandboxRecord>();
  const [logAttempt, setLogAttempt] = useState<number | undefined>(undefined);
  const [logLoading, setLogLoading] = useState(false);
  const [resultItem, setResultItem] = useState<DataSandboxRecord>();
  const [resultOpen, setResultOpen] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [mountTask, setMountTask] = useState<DataSandboxRecord>();
  const [projects, setProjects] = useState<DataSandboxRecord[]>([]);

  /* ------------------------------ SQL 工作台 ------------------------------ */
  const [wsSql, setWsSql] = useState('SELECT * FROM src LIMIT 100');
  const [wsParams, setWsParams] = useState('{}');
  const [wsNodeId, setWsNodeId] = useState('');
  const [wsDatatableId, setWsDatatableId] = useState('');
  const [wsPreview, setWsPreview] = useState<DataSandboxRecord>();
  const [wsRunning, setWsRunning] = useState(false);
  const [wsTaskId, setWsTaskId] = useState('');
  const [wsSaveArtifact, setWsSaveArtifact] = useState('');
  const [wsSaveOpen, setWsSaveOpen] = useState(false);
  const [wsSaveForm] = Form.useForm();

  /* ------------------------------ 依赖白名单 ------------------------------ */
  const [depEnabled, setDepEnabled] = useState('1');
  const [depKeyword, setDepKeyword] = useState('');
  const [depOpen, setDepOpen] = useState(false);
  const [depItem, setDepItem] = useState<DataSandboxRecord>();
  const [depForm] = Form.useForm();

  /* ------------------------------- 数据加载 ------------------------------- */

  const refreshArtifacts = useCallback(async () => {
    setArtifactLoading(true);
    try {
      setArtifacts(
        responseData(
          await DataDevApi.artifacts({ type: artifactType, keyword: artifactKeyword }),
          [],
        ),
      );
    } catch (error: any) {
      message.error(error.message || '加载制品失败');
    } finally {
      setArtifactLoading(false);
    }
  }, [artifactType, artifactKeyword]);

  const refreshTasks = useCallback(async () => {
    setTaskLoading(true);
    try {
      setTasks(
        responseData(
          await DataDevApi.tasks({
            status: taskStatus,
            runMode: taskRunMode,
            execType: taskExecType,
            keyword: taskKeyword,
          }),
          [],
        ),
      );
    } catch (error: any) {
      message.error(error.message || '加载任务失败');
    } finally {
      setTaskLoading(false);
    }
  }, [taskStatus, taskRunMode, taskExecType, taskKeyword]);

  const refreshDeps = useCallback(async () => {
    try {
      setDeps(
        responseData(
          await DataDevApi.dependencies({ enabled: depEnabled, keyword: depKeyword }),
          [],
        ),
      );
    } catch (error: any) {
      message.error(error.message || '加载依赖白名单失败');
    }
  }, [depEnabled, depKeyword]);

  useEffect(() => {
    refreshArtifacts();
  }, [refreshArtifacts]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    refreshDeps();
  }, [refreshDeps]);

  useEffect(() => {
    if (taskOpen) {
      DataDevApi.artifacts().then((res) => setAllArtifacts(responseData(res, [])));
      DataDevApi.dependencies({ enabled: '1' }).then((res) =>
        setDeps(responseData(res, [])),
      );
    }
  }, [taskOpen]);

  useEffect(() => {
    if (taskArtifactId) {
      DataDevApi.versions(taskArtifactId).then((res) =>
        setArtifactVersions(responseData(res, [])),
      );
    }
  }, [taskArtifactId]);

  useEffect(() => {
    if (versionsOpen && versionsItem) {
      setVersionsLoading(true);
      DataDevApi.versions(versionsItem.id)
        .then((res) => setVersions(responseData(res, [])))
        .finally(() => setVersionsLoading(false));
    }
  }, [versionsOpen, versionsItem]);

  /* ------------------------------- 制品操作 ------------------------------- */

  const openArtifactCreate = () => {
    setArtifactItem(undefined);
    artifactForm.resetFields();
    artifactForm.setFieldsValue({ type: 'SQL' });
    setArtifactOpen(true);
  };

  const openArtifactEdit = (row: DataSandboxRecord) => {
    setArtifactItem(row);
    artifactForm.setFieldsValue({
      name: row.name,
      description: row.description || '',
    });
    setArtifactOpen(true);
  };

  const saveArtifact = async (values: DataSandboxRecord) => {
    try {
      if (artifactItem?.id) {
        responseData(
          await DataDevApi.updateArtifact({ id: artifactItem.id, ...values }),
          {},
        );
        message.success('制品已更新');
      } else {
        responseData(await DataDevApi.createArtifact(values), {});
        message.success('制品已创建');
      }
      setArtifactOpen(false);
      artifactForm.resetFields();
      refreshArtifacts();
    } catch (error: any) {
      message.error(error.message || '保存制品失败');
    }
  };

  const deleteArtifact = async (row: DataSandboxRecord) => {
    try {
      responseData(await DataDevApi.deleteArtifact(row.id), {});
      message.success('制品已删除');
      refreshArtifacts();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  /** SQL/PYTHON 脚本版本：新建/编辑 → 保存为新版本（版本自增，不可变）。 */
  const openScriptVersion = (row: DataSandboxRecord) => {
    setVersionArtifact(row);
    setVersionContent('');
    scriptForm.resetFields();
    scriptForm.setFieldsValue({
      paramsSchema: '[]',
      defaultParams: '{}',
      dependencyNames: [],
    });
    setVersionOpen(true);
  };

  const saveScriptVersion = async (values: DataSandboxRecord) => {
    if (!versionArtifact) return;
    try {
      responseData(
        await DataDevApi.createVersion({
          artifactId: versionArtifact.id,
          contentText: versionContent,
          ...values,
        }),
        {},
      );
      message.success(`新版本已保存（v${(versionArtifact.latest_version || 0) + 1}）`);
      setVersionOpen(false);
      scriptForm.resetFields();
      refreshArtifacts();
    } catch (error: any) {
      message.error(error.message || '保存版本失败');
    }
  };

  /** JAR 上传：校验 .jar 后缀 + 大小，成功后新版本。 */
  const openJarUpload = (row: DataSandboxRecord) => {
    setJarArtifactId(row.id);
    setJarFile(undefined);
    jarForm.resetFields();
    jarForm.setFieldsValue({ paramsSchema: '[]', defaultParams: '{}' });
    setJarOpen(true);
  };

  const saveJarUpload = async (values: DataSandboxRecord) => {
    if (!jarFile) {
      message.warning('请选择 .jar 文件');
      return;
    }
    try {
      responseData(
        await DataDevApi.uploadJarVersion(jarArtifactId, jarFile, values),
        {},
      );
      message.success('JAR 版本已上传');
      setJarOpen(false);
      setJarFile(undefined);
      refreshArtifacts();
    } catch (error: any) {
      message.error(error.message || '上传失败');
    }
  };

  const openVersions = (row: DataSandboxRecord) => {
    setVersionsItem(row);
    setVersionsOpen(true);
  };

  const downloadJar = async (versionId: string) => {
    try {
      const blob = await DataDevApi.downloadJar(versionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${versionId}.jar`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      message.error(error.message || '下载失败');
    }
  };

  const deleteVersion = async (versionId: string) => {
    try {
      responseData(await DataDevApi.deleteVersion(versionId), {});
      message.success('版本已删除');
      if (versionsItem) {
        const res = await DataDevApi.versions(versionsItem.id);
        setVersions(responseData(res, []));
      }
      refreshArtifacts();
    } catch (error: any) {
      message.error(error.message || '删除版本失败');
    }
  };

  /* ------------------------------- 任务操作 ------------------------------- */

  const openTaskSubmit = () => {
    taskForm.resetFields();
    setPreview(undefined);
    taskForm.setFieldsValue({ runMode: 'DEV', execType: 'SQL', source: 'inline' });
    setTaskOpen(true);
  };

  const previewSource = async () => {
    const { nodeId, datatableId, limit } = taskForm.getFieldsValue();
    if (!nodeId || !datatableId) {
      message.warning('请先填写源节点与数据表 ID');
      return;
    }
    try {
      setPreview(
        responseData(
          await DataDevApi.previewSource(nodeId, datatableId, limit || 20),
          {},
        ),
      );
    } catch (error: any) {
      message.error(error.message || '预览失败');
    }
  };

  const submitTask = async (values: DataSandboxRecord) => {
    try {
      const { saveAs, artifactName, ...rest } = values;
      // 表单 params 为 JSON 字符串，后端要求对象
      if (typeof rest.params === 'string' && rest.params.trim()) {
        try {
          rest.params = JSON.parse(rest.params);
        } catch {
          message.warning('运行参数不是合法 JSON，已忽略');
          rest.params = {};
        }
      }
      let payload: DataSandboxRecord = rest;
      // 内联脚本 + 「保存任务」= 先落制品+版本，再按制品引用提交
      if (saveAs && artifactName && (rest.sql || rest.script)) {
        const contentText = rest.sql || rest.script;
        const existing = allArtifacts.find(
          (a) => a.name === artifactName && a.type === rest.execType,
        );
        let artifactId: string;
        if (existing) {
          artifactId = existing.id;
        } else {
          const created = responseData(
            await DataDevApi.createArtifact({
              name: artifactName,
              type: rest.execType,
            }),
            {},
          );
          artifactId = created.id;
        }
        const version = responseData(
          await DataDevApi.createVersion({
            artifactId,
            contentText,
            paramsSchema: values.paramsSchema || '[]',
            defaultParams: values.defaultParams || '{}',
            dependencyNames: rest.dependencyNames || [],
          }),
          {},
        );
        payload = { ...rest, artifactId, version: version.version };
        delete payload.sql;
        delete payload.script;
      }
      responseData(await DataDevApi.submitTask(payload), {});
      message.success('任务已提交');
      setTaskOpen(false);
      taskForm.resetFields();
      setPreview(undefined);
      refreshTasks();
      refreshArtifacts();
    } catch (error: any) {
      message.error(error.message || '提交失败');
    }
  };

  const directTask = async (row: DataSandboxRecord, action: 'cancel' | 'retry') => {
    try {
      if (action === 'cancel') {
        responseData(await DataDevApi.cancelTask(row.id), {});
        message.success('任务已取消');
      } else {
        responseData(await DataDevApi.retryTask(row.id), {});
        message.success('已重新执行');
      }
      refreshTasks();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const openDetail = async (row: DataSandboxRecord) => {
    setDetailItem(responseData(await DataDevApi.taskDetail(row.id), {}));
    setDetailOpen(true);
  };

  /** DEV 调试运行：打开日志 Drawer（runLog 全文 + 结果预览）。 */
  const openLog = async (row: DataSandboxRecord) => {
    setLogItem(row);
    setLogAttempt(undefined);
    setLogDetail(undefined);
    setLogOpen(true);
    await loadLog(row.id, undefined);
  };

  const loadLog = async (taskId: string, attempt?: number) => {
    setLogLoading(true);
    try {
      setLogDetail(responseData(await DataDevApi.runLog(taskId, attempt), {}));
      setLogAttempt(attempt);
    } catch (error: any) {
      message.error(error.message || '加载日志失败');
    } finally {
      setLogLoading(false);
    }
  };

  /** PROD 结果：打开结果 Drawer（viewResult 预览表 + 挂载项目）。 */
  const openResult = async (row: DataSandboxRecord) => {
    setResultLoading(true);
    setResultOpen(true);
    try {
      const resp = responseData(await DataDevApi.viewResult(row.id), { id: row.id });
      setResultItem({ ...resp, id: row.id });
    } catch (error: any) {
      message.error(error.message || '加载结果失败');
      setResultItem(undefined);
    } finally {
      setResultLoading(false);
    }
  };

  const openMount = (row: DataSandboxRecord) => {
    listP2PProject().then((res) => setProjects(responseData(res, [])));
    setMountTask({ ...row, mountProjectId: '' });
  };

  const mountResult = async () => {
    if (!mountTask) return;
    try {
      responseData(
        await DataDevApi.mountResult({
          taskId: mountTask.id,
          projectId: mountTask.mountProjectId,
        }),
        {},
      );
      message.success('结果已挂载到项目');
      setMountTask(undefined);
    } catch (error: any) {
      message.error(error.message || '挂载失败');
    }
  };

  /* ------------------------------ SQL 工作台 ------------------------------ */

  const wsPreviewSource = async () => {
    if (!wsNodeId || !wsDatatableId) {
      message.warning('请先填写源节点与数据表 ID');
      return;
    }
    try {
      setWsPreview(
        responseData(await DataDevApi.previewSource(wsNodeId, wsDatatableId, 20), {}),
      );
    } catch (error: any) {
      message.error(error.message || '预览失败');
    }
  };

  const wsRun = async () => {
    if (!wsNodeId || !wsDatatableId || !wsSql) {
      message.warning('请填写源表与 SQL');
      return;
    }
    setWsRunning(true);
    try {
      const data = responseData(
        await DataDevApi.submitTask({
          name: 'SQL 工作台',
          runMode: 'DEV',
          execType: 'SQL',
          nodeId: wsNodeId,
          datatableId: wsDatatableId,
          sql: wsSql,
          params: parsePreview(wsParams),
        }),
        {},
      );
      setWsTaskId(data.id);
      message.success('执行成功（开发调试）');
    } catch (error: any) {
      message.error(error.message || '执行失败');
    } finally {
      setWsRunning(false);
    }
  };

  const wsSave = async () => {
    if (!wsSql) {
      message.warning('请输入 SQL');
      return;
    }
    if (!wsSaveArtifact) {
      message.warning('请输入制品名称');
      return;
    }
    try {
      const existing = allArtifacts.find(
        (a) => a.name === wsSaveArtifact && a.type === 'SQL',
      );
      let artifactId: string;
      if (existing) {
        artifactId = existing.id;
      } else {
        const created = responseData(
          await DataDevApi.createArtifact({ name: wsSaveArtifact, type: 'SQL' }),
          {},
        );
        artifactId = created.id;
      }
      responseData(
        await DataDevApi.createVersion({ artifactId, contentText: wsSql }),
        {},
      );
      message.success(`SQL 已保存为制品 ${wsSaveArtifact} 新版本`);
      refreshArtifacts();
      setWsSaveOpen(false);
    } catch (error: any) {
      message.error(error.message || '保存失败');
    }
  };

  /* ------------------------------- 依赖操作 ------------------------------- */

  const openDepCreate = () => {
    setDepItem(undefined);
    depForm.resetFields();
    depForm.setFieldsValue({ enabled: true });
    setDepOpen(true);
  };

  const openDepEdit = (row: DataSandboxRecord) => {
    setDepItem(row);
    depForm.setFieldsValue({
      name: row.name,
      versionSpec: row.version_spec || '',
      description: row.description || '',
      enabled: row.enabled === 1,
    });
    setDepOpen(true);
  };

  const saveDep = async (values: DataSandboxRecord) => {
    try {
      if (depItem?.id) {
        responseData(
          await DataDevApi.updateDependency({ id: depItem.id, ...values }),
          {},
        );
        message.success('依赖已更新');
      } else {
        responseData(await DataDevApi.createDependency(values), {});
        message.success('依赖已创建');
      }
      setDepOpen(false);
      depForm.resetFields();
      refreshDeps();
    } catch (error: any) {
      message.error(error.message || '保存依赖失败');
    }
  };

  const deleteDep = async (row: DataSandboxRecord) => {
    try {
      responseData(await DataDevApi.deleteDependency(row.id), {});
      message.success('依赖已删除');
      refreshDeps();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  /* ------------------------------- 渲染 ------------------------------- */

  return (
    <MvpPage
      title="数据开发"
      description="JAR / SQL / Python 计算任务开发：制品与版本管理、调试运行与正式运行、结果数据集、依赖白名单"
      extra={
        <RefreshButton
          loading={artifactLoading || taskLoading}
          onClick={() => {
            refreshArtifacts();
            refreshTasks();
            refreshDeps();
          }}
        />
      }
    >
      <Tabs
        items={[
          {
            key: 'artifacts',
            label: '制品管理',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={artifactType}
                    onChange={setArtifactType}
                    style={{ width: 150 }}
                    options={[
                      { value: '', label: '全部类型' },
                      ...Object.entries(artifactTypeLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                  <Input.Search
                    placeholder="制品名称"
                    allowClear
                    onSearch={setArtifactKeyword}
                    style={{ width: 240 }}
                  />
                  <Button type="primary" onClick={openArtifactCreate}>
                    新建制品
                  </Button>
                </Space>
                <Table
                  rowKey="id"
                  loading={artifactLoading}
                  dataSource={artifacts}
                  scroll={{ x: 1100 }}
                  columns={[
                    {
                      title: '制品',
                      dataIndex: 'name',
                      render: (v: string, row: DataSandboxRecord) => (
                        <Space direction="vertical" size={0}>
                          <strong>{v}</strong>
                          <span style={{ color: '#888' }}>{row.id}</span>
                        </Space>
                      ),
                    },
                    {
                      title: '类型',
                      dataIndex: 'type',
                      render: (v: string) => (
                        <Tag color={artifactTypeColors[v]}>
                          {artifactTypeLabels[v] || v}
                        </Tag>
                      ),
                    },
                    { title: '最新版本', dataIndex: 'latest_version' },
                    { title: '创建人', dataIndex: 'created_by' },
                    { title: '更新时间', dataIndex: 'updated_at', render: formatTime },
                    {
                      title: '操作',
                      width: 260,
                      render: (_: unknown, row: DataSandboxRecord) => (
                        <Space wrap>
                          {row.type === 'JAR' ? (
                            <Button type="link" onClick={() => openJarUpload(row)}>
                              上传 JAR
                            </Button>
                          ) : (
                            <Button type="link" onClick={() => openScriptVersion(row)}>
                              新版本
                            </Button>
                          )}
                          <Button type="link" onClick={() => openVersions(row)}>
                            版本列表
                          </Button>
                          <Button type="link" onClick={() => openArtifactEdit(row)}>
                            编辑
                          </Button>
                          <Button
                            type="link"
                            danger
                            onClick={() => deleteArtifact(row)}
                          >
                            删除
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'tasks',
            label: '任务管理',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={taskStatus}
                    onChange={setTaskStatus}
                    style={{ width: 130 }}
                    options={[
                      { value: '', label: '全部状态' },
                      ...Object.entries(statusLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                  <Select
                    value={taskRunMode}
                    onChange={setTaskRunMode}
                    style={{ width: 150 }}
                    options={[
                      { value: '', label: '全部模式' },
                      ...Object.entries(runModeLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                  <Select
                    value={taskExecType}
                    onChange={setTaskExecType}
                    style={{ width: 130 }}
                    options={[
                      { value: '', label: '全部类型' },
                      ...Object.entries(execTypeLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                  <Input.Search
                    placeholder="任务 ID 或名称"
                    allowClear
                    onSearch={setTaskKeyword}
                    style={{ width: 240 }}
                  />
                  <Button type="primary" onClick={openTaskSubmit}>
                    提交任务
                  </Button>
                </Space>
                <Table
                  rowKey="id"
                  loading={taskLoading}
                  dataSource={tasks}
                  scroll={{ x: 1300 }}
                  columns={[
                    {
                      title: '任务',
                      dataIndex: 'id',
                      render: (v: string, row: DataSandboxRecord) => (
                        <Space direction="vertical" size={0}>
                          <strong>{row.name || v}</strong>
                          <span style={{ color: '#888' }}>{v}</span>
                        </Space>
                      ),
                    },
                    {
                      title: '类型 / 模式',
                      render: (_: unknown, row: DataSandboxRecord) => (
                        <Space size={4}>
                          <Tag color={artifactTypeColors[row.exec_type]}>
                            {execTypeLabels[row.exec_type] || row.exec_type}
                          </Tag>
                          <Tag color={row.run_mode === 'PROD' ? 'orange' : 'cyan'}>
                            {runModeLabels[row.run_mode] || row.run_mode}
                          </Tag>
                        </Space>
                      ),
                    },
                    {
                      title: '源表',
                      render: (_: unknown, row: DataSandboxRecord) =>
                        `${row.source_node_id}/${row.source_datatable_id}`,
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: (v: string, row: DataSandboxRecord) => (
                        <Tooltip title={row.error_message || ''}>
                          <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
                        </Tooltip>
                      ),
                    },
                    {
                      title: '行数',
                      render: (_: unknown, row: DataSandboxRecord) =>
                        `${row.source_rows} → ${row.result_rows}`,
                    },
                    { title: '提交人', dataIndex: 'created_by' },
                    { title: '提交时间', dataIndex: 'created_at', render: formatTime },
                    {
                      title: '操作',
                      width: 260,
                      render: (_: unknown, row: DataSandboxRecord) => (
                        <Space wrap>
                          {CANCELLABLE.includes(row.status) && (
                            <Button
                              type="link"
                              onClick={() => directTask(row, 'cancel')}
                            >
                              取消
                            </Button>
                          )}
                          {row.status === 'FAILED' && (
                            <Button
                              type="link"
                              onClick={() => directTask(row, 'retry')}
                            >
                              重试
                            </Button>
                          )}
                          {row.status === 'SUCCEEDED' && row.run_mode === 'DEV' && (
                            <Button type="link" onClick={() => openLog(row)}>
                              调试日志
                            </Button>
                          )}
                          {row.status === 'SUCCEEDED' && row.run_mode === 'PROD' && (
                            <Button type="link" onClick={() => openResult(row)}>
                              结果
                            </Button>
                          )}
                          <Button type="link" onClick={() => openDetail(row)}>
                            详情
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'sql',
            label: 'SQL 工作台',
            children: (
              <>
                <Space style={{ marginBottom: 12 }} wrap>
                  <Input
                    placeholder="源节点 ID，例如 alice"
                    value={wsNodeId}
                    onChange={(e) => setWsNodeId(e.target.value)}
                    style={{ width: 180 }}
                  />
                  <Input
                    placeholder="源数据表 ID"
                    value={wsDatatableId}
                    onChange={(e) => setWsDatatableId(e.target.value)}
                    style={{ width: 220 }}
                  />
                  <Button onClick={wsPreviewSource}>源数据预览</Button>
                  <Button type="primary" loading={wsRunning} onClick={wsRun}>
                    执行（开发调试）
                  </Button>
                  <Button onClick={() => setWsSaveOpen(true)}>保存为制品</Button>
                </Space>
                {wsPreview && (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 8 }}
                      message={`源表 ${wsPreview.name || wsPreview.datatableId} · ${
                        wsPreview.sourceRows
                      } 行`}
                    />
                    {renderPreviewTable(wsPreview)}
                  </>
                )}
                <Input.TextArea
                  value={wsSql}
                  onChange={(e) => setWsSql(e.target.value)}
                  rows={8}
                  style={{ fontFamily: 'monospace', marginBottom: 12 }}
                  placeholder="SELECT category, count(*) c FROM src GROUP BY category"
                />
                <Space style={{ marginBottom: 8 }}>
                  <span>参数 (JSON) ：</span>
                  <Input
                    value={wsParams}
                    onChange={(e) => setWsParams(e.target.value)}
                    style={{ width: 360 }}
                    placeholder='{"filter":"A"}'
                  />
                </Space>
                {wsTaskId && (
                  <Alert
                    type="success"
                    showIcon
                    style={{ marginBottom: 8 }}
                    action={
                      <Space>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => openLog({ id: wsTaskId } as DataSandboxRecord)}
                        >
                          调试日志
                        </Button>
                      </Space>
                    }
                    message={`调试任务 ${wsTaskId} 已成功`}
                  />
                )}
              </>
            ),
          },
          {
            key: 'deps',
            label: '依赖白名单',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={depEnabled}
                    onChange={setDepEnabled}
                    style={{ width: 130 }}
                    options={[
                      { value: '', label: '全部' },
                      { value: '1', label: '已启用' },
                      { value: '0', label: '已停用' },
                    ]}
                  />
                  <Input.Search
                    placeholder="依赖名"
                    allowClear
                    onSearch={setDepKeyword}
                    style={{ width: 220 }}
                  />
                  <Button type="primary" onClick={openDepCreate}>
                    新增依赖
                  </Button>
                </Space>
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Python 运行容器无网络、禁 pip，仅预装白名单包。新增依赖须同时重建 data-sandbox-python-runner 镜像并同步镜像内安装包，否则运行时 import 会被守卫拒绝。"
                />
                <Table
                  rowKey="id"
                  dataSource={deps}
                  scroll={{ x: 900 }}
                  columns={[
                    {
                      title: '依赖',
                      dataIndex: 'name',
                      render: (v: string) => <Tag color="purple">{v}</Tag>,
                    },
                    {
                      title: '版本约束',
                      dataIndex: 'version_spec',
                      render: (v: string) => v || '-',
                    },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      render: (v: number) =>
                        v === 1 ? (
                          <Tag color="success">启用</Tag>
                        ) : (
                          <Tag color="default">停用</Tag>
                        ),
                    },
                    {
                      title: '描述',
                      dataIndex: 'description',
                      render: (v: string) => v || '-',
                    },
                    { title: '创建人', dataIndex: 'created_by' },
                    { title: '更新时间', dataIndex: 'updated_at', render: formatTime },
                    {
                      title: '操作',
                      width: 140,
                      render: (_: unknown, row: DataSandboxRecord) => (
                        <Space wrap>
                          <Button type="link" onClick={() => openDepEdit(row)}>
                            编辑
                          </Button>
                          <Button type="link" danger onClick={() => deleteDep(row)}>
                            删除
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      {/* 制品 新建/编辑 */}
      <Modal
        title={artifactItem?.id ? `编辑制品：${artifactItem.name}` : '新建制品'}
        open={artifactOpen}
        onCancel={() => setArtifactOpen(false)}
        onOk={() => artifactForm.submit()}
      >
        <Form form={artifactForm} layout="vertical" onFinish={saveArtifact}>
          <Form.Item name="name" label="制品名称" rules={[{ required: true }]}>
            <Input placeholder="例如：银行对账聚合" />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true }]}
            tooltip="JAR：上传编译产物；SQL：SQL 脚本；Python：受控 Python 函数"
          >
            <Select
              disabled={!!artifactItem?.id}
              options={Object.entries(artifactTypeLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* SQL/PYTHON 脚本版本 */}
      <Modal
        title={`新增版本：${versionArtifact?.name || ''}（将保存为 v${
          (versionArtifact?.latest_version || 0) + 1
        }）`}
        open={versionOpen}
        width={720}
        onCancel={() => setVersionOpen(false)}
        onOk={() => scriptForm.submit()}
      >
        <Form form={scriptForm} layout="vertical" onFinish={saveScriptVersion}>
          <Form.Item
            label={versionArtifact?.type === 'PYTHON' ? 'Python 函数' : 'SQL 脚本'}
            required
          >
            <Input.TextArea
              value={versionContent}
              onChange={(e) => setVersionContent(e.target.value)}
              rows={10}
              style={{ fontFamily: 'monospace' }}
              placeholder={
                versionArtifact?.type === 'PYTHON'
                  ? 'import argparse, csv\nap = argparse.ArgumentParser()\n...'
                  : 'SELECT category, count(*) c FROM src GROUP BY category'
              }
            />
          </Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item
              name="paramsSchema"
              label="参数声明 (JSON)"
              style={{ width: 340 }}
            >
              <Input.TextArea
                rows={3}
                placeholder='[{"name":"filter","type":"string"}]'
              />
            </Form.Item>
            <Form.Item
              name="defaultParams"
              label="默认参数 (JSON)"
              style={{ width: 340 }}
            >
              <Input.TextArea rows={3} placeholder='{"filter":"A"}' />
            </Form.Item>
          </Space>
          {versionArtifact?.type === 'PYTHON' && (
            <Form.Item name="dependencyNames" label="依赖库白名单">
              <Select
                mode="multiple"
                allowClear
                placeholder="选择白名单依赖（可在依赖白名单页管理）"
              >
                {deps
                  .filter((d) => d.enabled === 1)
                  .map((d) => ({ value: d.name, label: d.name }))}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="description" label="版本说明">
            <Input placeholder="本次改动说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* JAR 上传 */}
      <Modal
        title="上传 JAR 新版本"
        open={jarOpen}
        onCancel={() => setJarOpen(false)}
        onOk={() => jarForm.submit()}
        okButtonProps={{ disabled: !jarFile }}
      >
        <Form form={jarForm} layout="vertical" onFinish={saveJarUpload}>
          <Form.Item label="JAR 文件" required>
            <Upload.Dragger
              beforeUpload={(file) => {
                if (!file.name.toLowerCase().endsWith('.jar')) {
                  message.error('仅支持 .jar 文件');
                  return Upload.LIST_IGNORE;
                }
                setJarFile(file as unknown as File);
                return false;
              }}
              maxCount={1}
              accept=".jar"
            >
              <p>点击或拖拽 .jar 文件到此处</p>
            </Upload.Dragger>
          </Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item
              name="paramsSchema"
              label="参数声明 (JSON)"
              style={{ width: 340 }}
            >
              <Input.TextArea
                rows={3}
                placeholder='[{"name":"filter","type":"string"}]'
              />
            </Form.Item>
            <Form.Item
              name="defaultParams"
              label="默认参数 (JSON)"
              style={{ width: 340 }}
            >
              <Input.TextArea rows={3} placeholder='{"filter":"A"}' />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="版本说明">
            <Input placeholder="本次改动说明" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="JAR 运行契约：CLI 程序将结果 CSV 写入 --output 文件（或输出到 stdout）；长驻服务会被超时终止并判定失败。"
          />
        </Form>
      </Modal>

      {/* 版本列表 */}
      <Modal
        title={`版本列表：${versionsItem?.name || ''}`}
        open={versionsOpen}
        width={900}
        footer={null}
        onCancel={() => setVersionsOpen(false)}
      >
        <Table
          rowKey="id"
          size="small"
          loading={versionsLoading}
          dataSource={versions}
          pagination={false}
          scroll={{ x: 800, y: 380 }}
          columns={[
            { title: '版本', dataIndex: 'version' },
            ...(versionsItem?.type === 'JAR'
              ? [
                  {
                    title: '大小',
                    dataIndex: 'size',
                    render: (v: number) => `${((v || 0) / 1024).toFixed(1)} KB`,
                  },
                  {
                    title: 'SHA256',
                    dataIndex: 'sha256',
                    render: (v: string) => (
                      <span style={{ fontFamily: 'monospace' }}>
                        {v ? v.slice(0, 16) + '…' : '-'}
                      </span>
                    ),
                  },
                ]
              : [
                  {
                    title: '内容',
                    dataIndex: 'content_text',
                    render: (v: string) => (
                      <Tooltip
                        title={
                          <pre style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>
                            {v}
                          </pre>
                        }
                      >
                        <span style={{ fontFamily: 'monospace', color: '#555' }}>
                          {v ? v.slice(0, 60) + (v.length > 60 ? '…' : '') : '-'}
                        </span>
                      </Tooltip>
                    ),
                  },
                ]),
            { title: '参数 Schema', dataIndex: 'params_schema' },
            { title: '创建人', dataIndex: 'created_by' },
            { title: '创建时间', dataIndex: 'created_at', render: formatTime },
            {
              title: '操作',
              width: 130,
              render: (_: unknown, row: DataSandboxRecord) => (
                <Space wrap>
                  {versionsItem?.type === 'JAR' ? (
                    <Button type="link" onClick={() => downloadJar(row.id)}>
                      下载
                    </Button>
                  ) : (
                    <Button
                      type="link"
                      onClick={() =>
                        Modal.info({
                          title: `版本 ${row.version} 内容`,
                          width: 720,
                          content: (
                            <pre
                              style={{
                                maxHeight: 420,
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {row.content_text || '(空)'}
                            </pre>
                          ),
                        })
                      }
                    >
                      查看
                    </Button>
                  )}
                  <Button type="link" danger onClick={() => deleteVersion(row.id)}>
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      {/* 任务 提交 */}
      <Modal
        title="提交计算任务"
        open={taskOpen}
        width={820}
        onCancel={() => setTaskOpen(false)}
        onOk={() => taskForm.submit()}
      >
        <Form
          form={taskForm}
          layout="vertical"
          initialValues={{ limit: 20 }}
          onFinish={submitTask}
        >
          <Space size="large" wrap style={{ width: '100%' }}>
            <Form.Item name="execType" label="执行类型" rules={[{ required: true }]}>
              <Select
                style={{ width: 150 }}
                options={Object.entries(execTypeLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Form.Item>
            <Form.Item name="runMode" label="运行模式" rules={[{ required: true }]}>
              <Radio.Group
                optionType="button"
                options={Object.entries(runModeLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Form.Item>
            <Form.Item name="name" label="任务名称">
              <Input placeholder="默认：计算任务-<id>" style={{ width: 200 }} />
            </Form.Item>
          </Space>
          <Space size="large" wrap style={{ width: '100%' }}>
            <Form.Item name="nodeId" label="源节点" rules={[{ required: true }]}>
              <Input placeholder="例如 alice" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item
              name="datatableId"
              label="源数据表 ID"
              rules={[{ required: true }]}
            >
              <Input placeholder="数据表 ID" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item label="源数据预览">
              <Space>
                <Form.Item name="limit" noStyle>
                  <InputNumber min={1} max={100} style={{ width: 80 }} />
                </Form.Item>
                <Button onClick={previewSource}>预览前 N 行</Button>
              </Space>
            </Form.Item>
          </Space>
          {preview && renderPreviewTable(preview)}
          {taskExec === 'JAR' ? (
            <>
              <Space size="large" wrap style={{ width: '100%' }}>
                <Form.Item
                  name="artifactId"
                  label="JAR 制品"
                  rules={[{ required: true }]}
                >
                  <Select
                    style={{ width: 260 }}
                    showSearch
                    optionFilterProp="label"
                    options={allArtifacts
                      .filter((a) => a.type === 'JAR')
                      .map((a) => ({
                        value: a.id,
                        label: `${a.name} (v${a.latest_version})`,
                      }))}
                  />
                </Form.Item>
                <Form.Item name="version" label="版本" rules={[{ required: true }]}>
                  <Select
                    style={{ width: 120 }}
                    options={artifactVersions
                      .filter((v) => v.version > 0)
                      .map((v) => ({ value: v.version, label: `v${v.version}` }))}
                  />
                </Form.Item>
              </Space>
              <Alert
                type="info"
                showIcon
                message="JAR 运行契约：CLI 程序将结果 CSV 写入 --output 文件（或 stdout）；长驻服务超时终止判失败。"
              />
            </>
          ) : (
            <>
              <Form.Item name="source" label="脚本来源">
                <Radio.Group
                  optionType="button"
                  options={[
                    { value: 'inline', label: '内联脚本' },
                    { value: 'artifact', label: '已有制品版本' },
                  ]}
                />
              </Form.Item>
              {taskSource === 'artifact' ? (
                <Space size="large" wrap>
                  <Form.Item
                    name="artifactId"
                    label="制品"
                    rules={[{ required: true }]}
                  >
                    <Select
                      style={{ width: 260 }}
                      showSearch
                      optionFilterProp="label"
                      options={allArtifacts
                        .filter((a) => a.type === taskExec)
                        .map((a) => ({
                          value: a.id,
                          label: `${a.name} (v${a.latest_version})`,
                        }))}
                    />
                  </Form.Item>
                  <Form.Item name="version" label="版本" rules={[{ required: true }]}>
                    <Select
                      style={{ width: 120 }}
                      options={artifactVersions
                        .filter((v) => v.version > 0)
                        .map((v) => ({ value: v.version, label: `v${v.version}` }))}
                    />
                  </Form.Item>
                </Space>
              ) : (
                <>
                  <Form.Item
                    name={taskExec === 'SQL' ? 'sql' : 'script'}
                    label={taskExec === 'SQL' ? 'SQL 脚本' : 'Python 函数'}
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea
                      rows={8}
                      style={{ fontFamily: 'monospace' }}
                      placeholder={
                        taskExec === 'SQL'
                          ? 'SELECT category, count(*) c FROM src GROUP BY category'
                          : 'import argparse, csv\nap = argparse.ArgumentParser()\n...'
                      }
                    />
                  </Form.Item>
                  {taskExec === 'PYTHON' && (
                    <Form.Item name="dependencyNames" label="依赖库白名单">
                      <Select mode="multiple" allowClear placeholder="选择白名单依赖">
                        {deps
                          .filter((d) => d.enabled === 1)
                          .map((d) => ({ value: d.name, label: d.name }))}
                      </Select>
                    </Form.Item>
                  )}
                  <Form.Item label="保存任务">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Form.Item name="saveAs" valuePropName="checked" noStyle>
                        <Checkbox>保存脚本为制品新版本</Checkbox>
                      </Form.Item>
                      <Form.Item name="artifactName" noStyle>
                        <Input
                          placeholder="制品名称（不存在则自动创建）"
                          style={{ width: 380 }}
                        />
                      </Form.Item>
                    </Space>
                  </Form.Item>
                </>
              )}
            </>
          )}
          <Form.Item name="params" label="运行参数 (JSON)">
            <Input.TextArea rows={2} placeholder='{"filter":"A"}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务详情 */}
      <Drawer
        title={`任务详情：${detailItem?.id || ''}`}
        width={680}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {detailItem && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space wrap>
              <Tag color={statusColors[detailItem.status]}>
                {statusLabels[detailItem.status] || detailItem.status}
              </Tag>
              <Tag color={artifactTypeColors[detailItem.exec_type]}>
                {execTypeLabels[detailItem.exec_type] || detailItem.exec_type}
              </Tag>
              <Tag color={detailItem.run_mode === 'PROD' ? 'orange' : 'cyan'}>
                {runModeLabels[detailItem.run_mode] || detailItem.run_mode}
              </Tag>
              {detailItem.result_datatable_id && (
                <Tag color="green">
                  结果：{detailItem.result_node_id}/{detailItem.result_datatable_id}（
                  {detailItem.result_rows} 行）
                </Tag>
              )}
            </Space>
            {detailItem.error_message && (
              <div style={{ color: '#cf1322' }}>错误：{detailItem.error_message}</div>
            )}
            <div>
              源表：{detailItem.source_node_id}/{detailItem.source_datatable_id}（
              {detailItem.source_rows} 行）
            </div>
            <div>
              创建：{detailItem.created_by} · {formatTime(detailItem.created_at)}
            </div>
            {detailItem.finished_at && (
              <div>完成：{formatTime(detailItem.finished_at)}</div>
            )}
            {detailItem.retry_count > 0 && (
              <div>重试次数：{detailItem.retry_count}</div>
            )}
            <strong>血缘</strong>
            {detailItem.lineage?.length ? (
              <Timeline
                items={(detailItem.lineage as DataSandboxRecord[]).map((item) => ({
                  color: 'blue',
                  children: (
                    <>
                      <strong>{item.op_type}</strong>
                      <div>
                        {item.source_node_id}/{item.source_datatable_id} →{' '}
                        {item.target_node_id}/{item.target_datatable_id}
                      </div>
                      <div>
                        {item.created_by} · {formatTime(item.created_at)}
                      </div>
                    </>
                  ),
                }))}
              />
            ) : (
              <div style={{ color: '#888' }}>无血缘（DEV 调试运行不产生血缘）</div>
            )}
            {detailItem.content_snapshot && (
              <>
                <strong>脚本快照</strong>
                <pre
                  style={{
                    maxHeight: 260,
                    overflow: 'auto',
                    background: '#f5f5f5',
                    padding: 8,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {detailItem.content_snapshot}
                </pre>
              </>
            )}
            {(detailItem.runLogs || []).length > 0 && (
              <>
                <strong>调试日志摘要</strong>
                {(detailItem.runLogs as DataSandboxRecord[]).map((l) => (
                  <div key={l.id} style={{ color: '#555' }}>
                    attempt {l.attempt} · {l.log_len} 字节 · {formatTime(l.created_at)}
                  </div>
                ))}
              </>
            )}
          </Space>
        )}
      </Drawer>

      {/* 调试日志 */}
      <Drawer
        title={`调试日志：${logItem?.id || ''}`}
        width={760}
        open={logOpen}
        onClose={() => setLogOpen(false)}
      >
        {logItem && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space wrap>
              <Button.Group size="small">
                {[undefined, 0, 1, 2, 3].map((attempt) => (
                  <Button
                    key={String(attempt)}
                    type={logAttempt === attempt ? 'primary' : 'default'}
                    onClick={() => loadLog(logItem.id, attempt)}
                  >
                    {attempt === undefined ? '全部' : `attempt ${attempt}`}
                  </Button>
                ))}
              </Button.Group>
              <Button size="small" onClick={() => loadLog(logItem.id, logAttempt)}>
                刷新
              </Button>
            </Space>
            <div>
              <strong>结果预览（DEV 调试）</strong>
              {logItem.result_preview &&
                renderPreviewTable(parsePreview(logItem.result_preview))}
            </div>
            <div>
              <strong>日志</strong>
              {logLoading ? (
                <div>加载中…</div>
              ) : (
                <pre
                  style={{
                    maxHeight: 420,
                    overflow: 'auto',
                    background: '#1f1f1f',
                    color: '#d9d9d9',
                    padding: 12,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {logDetail?.attempt !== undefined
                    ? logDetail.logText || '(该次运行无日志)'
                    : (logDetail?.attempts || [])
                        .map(
                          (l: DataSandboxRecord) =>
                            `[attempt ${l.attempt}] ${l.log_text}`,
                        )
                        .join('\n') || '(无日志)'}
                </pre>
              )}
            </div>
          </Space>
        )}
      </Drawer>

      {/* 结果 Drawer */}
      <Drawer
        title={`运行结果：${resultItem?.id || ''}`}
        width={820}
        open={resultOpen}
        onClose={() => setResultOpen(false)}
      >
        {resultLoading ? (
          <div>加载中…</div>
        ) : (
          resultItem && (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Space wrap>
                <Tag color={resultItem.runMode === 'DEV' ? 'cyan' : 'orange'}>
                  {runModeLabels[resultItem.runMode] || resultItem.runMode}
                </Tag>
                <Tag>
                  源 {resultItem.sourceRows} 行 → 结果 {resultItem.resultRows} 行
                </Tag>
                {resultItem.resultDatatableId && (
                  <Tag color="green">
                    {resultItem.resultNodeId}/{resultItem.resultDatatableId}
                  </Tag>
                )}
              </Space>
              {renderPreviewTable(resultItem.preview)}
              {resultItem.runMode === 'PROD' && (
                <Space>
                  <Button type="primary" onClick={() => openMount(resultItem)}>
                    挂载到项目
                  </Button>
                </Space>
              )}
            </Space>
          )
        )}
      </Drawer>

      {/* 挂载项目 */}
      <Modal
        title="挂载结果到项目"
        open={!!mountTask}
        onCancel={() => setMountTask(undefined)}
        onOk={mountResult}
      >
        <Form layout="vertical">
          <Form.Item label="结果数据集">
            {mountTask
              ? `${mountTask.resultNodeId || mountTask.result_node_id}/${
                  mountTask.resultDatatableId || mountTask.result_datatable_id
                }`
              : ''}
          </Form.Item>
          <Form.Item label="目标项目" required>
            <Select
              value={mountTask?.mountProjectId}
              onChange={(v) =>
                setMountTask({ ...(mountTask as DataSandboxRecord), mountProjectId: v })
              }
              showSearch
              optionFilterProp="label"
              placeholder="选择项目"
              options={(projects || []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* SQL 工作台：保存为制品 */}
      <Modal
        title="保存 SQL 为制品"
        open={wsSaveOpen}
        onCancel={() => setWsSaveOpen(false)}
        onOk={wsSave}
      >
        <Form layout="vertical">
          <Form.Item label="制品名称" required>
            <Input
              value={wsSaveArtifact}
              onChange={(e) => setWsSaveArtifact(e.target.value)}
              placeholder="例如：月度统计 SQL（不存在则自动创建制品）"
            />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="保存为 SQL 制品的新版本（版本自增，不可变），可在「制品管理」查看历史版本。"
          />
        </Form>
      </Modal>

      {/* 依赖 新建/编辑 */}
      <Modal
        title={depItem?.id ? `编辑依赖：${depItem.name}` : '新增白名单依赖'}
        open={depOpen}
        onCancel={() => setDepOpen(false)}
        onOk={() => depForm.submit()}
      >
        <Form form={depForm} layout="vertical" onFinish={saveDep}>
          <Form.Item
            name="name"
            label="依赖名"
            rules={[{ required: true }]}
            tooltip="注意：须与 data-sandbox-python-runner 镜像内预装包一致，否则运行时 import 被守卫拒绝"
          >
            <Input placeholder="例如 scipy" />
          </Form.Item>
          <Form.Item name="versionSpec" label="版本约束">
            <Input placeholder="例如 >=1.10" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" initialValue>
            <Radio.Group
              options={[
                { value: true, label: '启用' },
                { value: false, label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </MvpPage>
  );
};
