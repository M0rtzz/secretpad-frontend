import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { formatTime, MvpPage, RefreshButton } from '@/modules/data-sandbox-mvp/common';
import { DataGovernanceApi, DataAssetApi, responseData } from '@/services/data-sandbox';
import type { DataSandboxRecord } from '@/services/data-sandbox';
import { listP2PProject } from '@/services/secretpad/P2PProjectController';

import {
  GovernanceConfigFields,
  governanceColumnsFromPreview,
  maskingFormRows,
  samplingFormValues,
  transformMaskingRows,
  transformSamplingForm,
} from './governance-config-form';

const policyTypeLabels: Record<string, string> = {
  SAMPLING: '抽样',
  MASKING: '脱敏',
  SAMPLING_MASKING: '抽样+脱敏',
};

const execModeLabels: Record<string, string> = {
  BUILTIN: '内置引擎',
  CUSTOM: '自定义代码',
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

export const DataGovernanceComponent = () => {
  /* --------------------------------- 策略 --------------------------------- */
  const [policies, setPolicies] = useState<DataSandboxRecord[]>([]);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyType, setPolicyType] = useState('');
  const [policyKeyword, setPolicyKeyword] = useState('');
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyItem, setPolicyItem] = useState<DataSandboxRecord>();
  const [policyForm] = Form.useForm();
  const editingPolicyType = Form.useWatch('policyType', policyForm);

  /* --------------------------------- 任务 --------------------------------- */
  const [tasks, setTasks] = useState<DataSandboxRecord[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState('');
  const [taskExecMode, setTaskExecMode] = useState('');
  const [taskKeyword, setTaskKeyword] = useState('');
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm] = Form.useForm();
  const taskMode = Form.useWatch('execMode', taskForm);
  const [preview, setPreview] = useState<DataSandboxRecord>();
  const [sourceAssets, setSourceAssets] = useState<DataSandboxRecord[]>([]);

  /* ------------------------------- 详情 / 结果 ------------------------------- */
  const [detailItem, setDetailItem] = useState<DataSandboxRecord>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [results, setResults] = useState<DataSandboxRecord[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [mountTask, setMountTask] = useState<DataSandboxRecord>();
  const [projects, setProjects] = useState<DataSandboxRecord[]>([]);
  /* 结果数据展示（仅脱敏后结果可查看；表头携带数据源） */
  const [viewItem, setViewItem] = useState<DataSandboxRecord>();
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  /* --------------------------------- 血缘 --------------------------------- */
  const [lineage, setLineage] = useState<DataSandboxRecord[]>([]);
  const [lineageQuery, setLineageQuery] = useState({ nodeId: '', datatableId: '' });
  const [lineageLoading, setLineageLoading] = useState(false);

  const refreshPolicies = useCallback(async () => {
    setPolicyLoading(true);
    try {
      setPolicies(
        responseData(
          await DataGovernanceApi.policies({
            type: policyType,
            keyword: policyKeyword,
          }),
          [],
        ),
      );
    } catch (error: any) {
      message.error(error.message || '加载策略失败');
    } finally {
      setPolicyLoading(false);
    }
  }, [policyType, policyKeyword]);

  const refreshTasks = useCallback(async () => {
    setTaskLoading(true);
    try {
      setTasks(
        responseData(
          await DataGovernanceApi.tasks({
            status: taskStatus,
            execMode: taskExecMode,
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
  }, [taskStatus, taskExecMode, taskKeyword]);

  useEffect(() => {
    refreshPolicies();
  }, [refreshPolicies]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    DataAssetApi.catalog({}).then((response) =>
      setSourceAssets(
        responseData(response, []).filter(
          (asset: DataSandboxRecord) => asset.data_stage === 'RAW',
        ),
      ),
    );
  }, []);

  useEffect(() => {
    if (resultsOpen) {
      DataGovernanceApi.results().then((res) => setResults(responseData(res, [])));
      listP2PProject().then((res) => setProjects(responseData(res, [])));
    }
  }, [resultsOpen]);

  const openPolicyCreate = () => {
    setPolicyItem(undefined);
    policyForm.resetFields();
    policyForm.setFieldsValue({
      policyType: 'SAMPLING',
      samplingMethod: 'RANDOM',
      samplingMode: 'count',
      samplingCount: 100,
      maskingRows: [],
    });
    setPolicyOpen(true);
  };

  const openPolicyEdit = (row: DataSandboxRecord) => {
    setPolicyItem(row);
    policyForm.setFieldsValue({
      name: row.name,
      description: row.description || '',
      policyType: row.policy_type,
      ...samplingFormValues(row.sampling_method, row.sampling_params),
      maskingRows: maskingFormRows(row.masking_columns),
    });
    setPolicyOpen(true);
  };

  const savePolicy = async (values: DataSandboxRecord) => {
    try {
      const payload = { ...values };
      payload.samplingParams =
        values.policyType === 'MASKING'
          ? '{}'
          : JSON.stringify(transformSamplingForm(values));
      payload.maskingColumns =
        values.policyType === 'SAMPLING'
          ? '[]'
          : JSON.stringify(transformMaskingRows(values.maskingRows || []));
      if (values.policyType === 'MASKING') payload.samplingMethod = '';
      delete payload.samplingMode;
      delete payload.samplingCount;
      delete payload.samplingRatio;
      delete payload.samplingSeed;
      delete payload.strataColumns;
      delete payload.clusterMode;
      delete payload.clusterColumn;
      delete payload.blockSize;
      delete payload.maskingRows;
      if (policyItem?.id) {
        responseData(
          await DataGovernanceApi.updatePolicy({ id: policyItem.id, ...payload }),
          {},
        );
        message.success('策略已更新');
      } else {
        responseData(await DataGovernanceApi.createPolicy(payload), {});
        message.success('策略已创建');
      }
      setPolicyOpen(false);
      policyForm.resetFields();
      refreshPolicies();
    } catch (error: any) {
      message.error(error.message || '保存策略失败');
    }
  };

  const deletePolicy = async (row: DataSandboxRecord) => {
    try {
      responseData(await DataGovernanceApi.deletePolicy(row.id), {});
      message.success('策略已删除');
      refreshPolicies();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const openTaskSubmit = () => {
    taskForm.resetFields();
    setPreview(undefined);
    taskForm.setFieldsValue({ execMode: 'BUILTIN' });
    setTaskOpen(true);
  };

  /** 选择策略后自动填充抽样/脱敏配置（可再手工覆盖，覆盖后按内联执行）；清空则还原为空配置。 */
  const onPolicyChange = (policyId?: string) => {
    const policy = (policies || []).find((p) => p.id === policyId);
    if (policy) {
      const columns = governanceColumnsFromPreview(preview);
      taskForm.setFieldsValue({
        ...samplingFormValues(policy.sampling_method, policy.sampling_params),
        maskingRows: maskingFormRows(policy.masking_columns, columns),
      });
    } else {
      taskForm.setFieldsValue({
        samplingMethod: undefined,
        maskingRows: maskingFormRows([], governanceColumnsFromPreview(preview)),
      });
    }
  };

  const loadSourcePreview = async (nodeId: string, datatableId: string, limit = 5) => {
    if (!nodeId || !datatableId) {
      message.warning('请先填写源节点与数据表 ID');
      return;
    }
    try {
      const sourcePreview = responseData(
        await DataGovernanceApi.preview(nodeId, datatableId, limit || 5),
        {},
      );
      setPreview(sourcePreview);
      const currentRows = taskForm.getFieldValue('maskingRows') || [];
      taskForm.setFieldValue(
        'maskingRows',
        maskingFormRows(
          transformMaskingRows(currentRows),
          governanceColumnsFromPreview(sourcePreview),
        ),
      );
    } catch (error: any) {
      message.error(error.message || '预览失败');
    }
  };

  const previewSource = async () => {
    const { nodeId, datatableId, limit } = taskForm.getFieldsValue();
    await loadSourcePreview(nodeId, datatableId, limit || 5);
  };

  /** 组装后端契约：内联抽样 {method,...params}、内联脱敏 [{column,method,params}]、policyId；剔除表单专用字段。
   *  后端 DataGovernanceService 仅识别 sampling(Map)/masking(List)/policyId，字段名不匹配会被静默丢弃。 */
  const buildGovernanceTaskPayload = (values: DataSandboxRecord) => {
    const payload: DataSandboxRecord = { ...values };
    delete payload.limit; // 预览行数，非任务参数
    delete payload.samplingMethod;
    delete payload.samplingMode;
    delete payload.samplingCount;
    delete payload.samplingRatio;
    delete payload.samplingSeed;
    delete payload.strataColumns;
    delete payload.clusterMode;
    delete payload.clusterColumn;
    delete payload.blockSize;
    delete payload.maskingRows;
    if ((payload.execMode || 'BUILTIN') === 'CUSTOM') {
      delete payload.sampling;
      delete payload.masking;
      return payload;
    }
    // 抽样：结构化表单 → {method,...params}
    if (values.samplingMethod) {
      payload.sampling = {
        method: values.samplingMethod,
        ...transformSamplingForm(values),
      };
    }
    // 脱敏：逐列表单 → [{column,method,params}]
    const masking = transformMaskingRows(values.maskingRows || []);
    if (masking.length > 0) {
      payload.masking = masking;
    }
    return payload;
  };

  const submitTask = async (values: DataSandboxRecord) => {
    let payload: DataSandboxRecord;
    try {
      payload = buildGovernanceTaskPayload(values);
    } catch (error: any) {
      message.error(error.message || '参数校验失败');
      return;
    }
    try {
      responseData(await DataGovernanceApi.submitTask(payload), {});
      message.success('任务已提交');
      setTaskOpen(false);
      taskForm.resetFields();
      setPreview(undefined);
      refreshTasks();
    } catch (error: any) {
      message.error(error.message || '提交失败');
    }
  };

  const directTask = async (row: DataSandboxRecord, action: 'cancel' | 'retry') => {
    try {
      if (action === 'cancel') {
        responseData(await DataGovernanceApi.cancelTask(row.id), {});
        message.success('任务已取消');
      } else {
        responseData(await DataGovernanceApi.retryTask(row.id), {});
        message.success('已重新执行');
      }
      refreshTasks();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const openDetail = async (row: DataSandboxRecord) => {
    setDetailItem(responseData(await DataGovernanceApi.taskDetail(row.id), {}));
    setDetailOpen(true);
  };

  /** 查看结果数据：仅脱敏后的结果返回行（masked=true）；未脱敏显示提示（含真实数据不可展示）。 */
  const openResultView = async (row: DataSandboxRecord) => {
    setViewLoading(true);
    setViewOpen(true);
    try {
      setViewItem(
        responseData(await DataGovernanceApi.viewResult(row.id), { id: row.id }),
      );
    } catch (error: any) {
      message.error(error.message || '加载结果数据失败');
      setViewItem(undefined);
    } finally {
      setViewLoading(false);
    }
  };

  const mountResult = async () => {
    if (!mountTask) return;
    try {
      responseData(
        await DataGovernanceApi.mountResult({
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

  const refreshLineage = useCallback(async () => {
    setLineageLoading(true);
    try {
      setLineage(
        responseData(
          await DataGovernanceApi.lineage(
            lineageQuery.nodeId,
            lineageQuery.datatableId,
          ),
          [],
        ),
      );
    } catch (error: any) {
      message.error(error.message || '查询血缘失败');
    } finally {
      setLineageLoading(false);
    }
  }, [lineageQuery]);

  return (
    <MvpPage
      title="数据抽样与脱敏"
      description="抽样与脱敏策略、任务执行（内置引擎/自定义代码）、结果数据集、血缘与源数据预览"
      extra={
        <RefreshButton
          loading={policyLoading || taskLoading}
          onClick={() => {
            refreshPolicies();
            refreshTasks();
          }}
        />
      }
    >
      <Tabs
        items={[
          {
            key: 'policies',
            label: '策略管理',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={policyType}
                    onChange={setPolicyType}
                    style={{ width: 150 }}
                    options={[
                      { value: '', label: '全部类型' },
                      ...Object.entries(policyTypeLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                  <Input.Search
                    placeholder="策略名称"
                    allowClear
                    onSearch={setPolicyKeyword}
                    style={{ width: 240 }}
                  />
                  <Button type="primary" onClick={openPolicyCreate}>
                    新建策略
                  </Button>
                </Space>
                <Table
                  rowKey="id"
                  loading={policyLoading}
                  dataSource={policies}
                  scroll={{ x: 1000 }}
                  columns={[
                    {
                      title: '策略',
                      dataIndex: 'name',
                      render: (v: string, row: DataSandboxRecord) => (
                        <Space direction="vertical" size={0}>
                          <strong>{v}</strong>
                          <span>
                            <Tag color="blue">
                              {policyTypeLabels[row.policy_type] || row.policy_type}
                            </Tag>
                          </span>
                        </Space>
                      ),
                    },
                    {
                      title: '抽样方法',
                      dataIndex: 'sampling_method',
                      render: (v: string) => (v ? v : '-'),
                    },
                    {
                      title: '脱敏列',
                      dataIndex: 'masking_columns',
                      render: (v: string) => {
                        let count = 0;
                        try {
                          count = JSON.parse(v || '[]').length;
                        } catch {
                          count = 0;
                        }
                        return count > 0 ? `${count} 列` : '-';
                      },
                    },
                    { title: '创建人', dataIndex: 'created_by' },
                    { title: '更新时间', dataIndex: 'updated_at', render: formatTime },
                    {
                      title: '操作',
                      width: 160,
                      render: (_: unknown, row: DataSandboxRecord) => (
                        <Space wrap>
                          <Button type="link" onClick={() => openPolicyEdit(row)}>
                            编辑
                          </Button>
                          <Button type="link" danger onClick={() => deletePolicy(row)}>
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
                    value={taskExecMode}
                    onChange={setTaskExecMode}
                    style={{ width: 140 }}
                    options={[
                      { value: '', label: '全部模式' },
                      ...Object.entries(execModeLabels).map(([value, label]) => ({
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
                  <Button onClick={() => setResultsOpen(true)}>结果数据集</Button>
                </Space>
                <Table
                  rowKey="id"
                  loading={taskLoading}
                  dataSource={tasks}
                  scroll={{ x: 1200 }}
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
                      title: '模式',
                      dataIndex: 'exec_mode',
                      render: (v: string) => (
                        <Tag color={v === 'CUSTOM' ? 'purple' : 'blue'}>
                          {execModeLabels[v] || v}
                        </Tag>
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
                      width: 220,
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
                          {row.status === 'SUCCEEDED' && row.result_datatable_id && (
                            <Button type="link" onClick={() => openResultView(row)}>
                              查看结果
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
            key: 'lineage',
            label: '血缘',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input
                    placeholder="节点 ID（留空为全部）"
                    value={lineageQuery.nodeId}
                    onChange={(e) =>
                      setLineageQuery({ ...lineageQuery, nodeId: e.target.value })
                    }
                    style={{ width: 200 }}
                  />
                  <Input
                    placeholder="数据表 ID（可选）"
                    value={lineageQuery.datatableId}
                    onChange={(e) =>
                      setLineageQuery({ ...lineageQuery, datatableId: e.target.value })
                    }
                    style={{ width: 200 }}
                  />
                  <Button type="primary" onClick={refreshLineage}>
                    查询
                  </Button>
                </Space>
                <Table
                  rowKey="id"
                  loading={lineageLoading}
                  dataSource={lineage}
                  scroll={{ x: 1000 }}
                  columns={[
                    {
                      title: '血缘链',
                      render: (_: unknown, row: DataSandboxRecord) => (
                        <Space wrap>
                          <Tag>
                            {row.source_node_id}/{row.source_datatable_id}
                          </Tag>
                          <span>→</span>
                          <Tag color="green">
                            {row.target_node_id}/{row.target_datatable_id}
                          </Tag>
                        </Space>
                      ),
                    },
                    {
                      title: '操作',
                      dataIndex: 'op_type',
                      render: (v: string) => <Tag color="cyan">{v}</Tag>,
                    },
                    { title: '任务', dataIndex: 'task_id' },
                    { title: '创建人', dataIndex: 'created_by' },
                    { title: '创建时间', dataIndex: 'created_at', render: formatTime },
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      {/* 策略 新建/编辑 */}
      <Modal
        title={policyItem?.id ? `编辑策略：${policyItem.name}` : '新建策略'}
        open={policyOpen}
        width={1100}
        onCancel={() => setPolicyOpen(false)}
        onOk={() => policyForm.submit()}
      >
        <Form form={policyForm} layout="vertical" onFinish={savePolicy}>
          <Form.Item name="name" label="策略名称" rules={[{ required: true }]}>
            <Input placeholder="例如：手机号脱敏策略" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="policyType" label="策略类型" rules={[{ required: true }]}>
            <Select
              options={Object.entries(policyTypeLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <GovernanceConfigFields
            form={policyForm}
            allowCustomColumns
            enableSampling={editingPolicyType !== 'MASKING'}
            enableMasking={editingPolicyType !== 'SAMPLING'}
          />
        </Form>
      </Modal>

      {/* 任务 提交 */}
      <Modal
        title="提交数据抽样与脱敏任务"
        open={taskOpen}
        width={1180}
        onCancel={() => setTaskOpen(false)}
        onOk={() => taskForm.submit()}
      >
        <Form
          form={taskForm}
          layout="vertical"
          initialValues={{ limit: 5 }}
          onFinish={submitTask}
        >
          <Form.Item name="execMode" label="执行模式" rules={[{ required: true }]}>
            <Select
              options={Object.entries(execModeLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="policyId"
            label="复用策略（可选）"
            tooltip="选择已有策略后自动填充下方抽样/脱敏配置，可直接按策略执行所选数据的抽取与脱敏；也可在其基础上手工调整（内联覆盖策略）"
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择已有策略（gp-xxx），自动填充抽样/脱敏配置"
              onChange={onPolicyChange}
              options={(policies || []).map((p) => ({
                value: p.id,
                label: `${p.name}（${
                  policyTypeLabels[p.policy_type] || p.policy_type
                }）`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="sourceAssetId"
            label="源数据"
            rules={[{ required: true, message: '请从数据目录选择源数据' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="从数据目录选择源数据"
              onChange={(assetId) => {
                const asset = sourceAssets.find((item) => item.id === assetId);
                taskForm.setFieldsValue({
                  nodeId: asset?.provider_node_id,
                  datatableId: asset?.datatable_id || asset?.id,
                });
                setPreview(undefined);
                if (asset) {
                  void loadSourcePreview(
                    asset.provider_node_id,
                    asset.datatable_id || asset.id,
                    taskForm.getFieldValue('limit') || 5,
                  );
                }
              }}
              options={sourceAssets.map((asset) => ({
                value: asset.id,
                label: `${asset.name}（${asset.provider_node_id}）`,
              }))}
            />
          </Form.Item>
          <Form.Item name="nodeId" hidden rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="datatableId" hidden rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space size="large" wrap style={{ width: '100%' }}>
            <Form.Item name="name" label="任务名称">
              <Input placeholder="默认：抽样脱敏任务-<id>" style={{ width: 220 }} />
            </Form.Item>
          </Space>
          <Form.Item label="源数据预览">
            <Space>
              <Form.Item name="limit" noStyle>
                <InputNumber min={1} max={100} style={{ width: 80 }} />
              </Form.Item>
              <Button onClick={previewSource}>预览前 N 行</Button>
            </Space>
          </Form.Item>
          {preview && (
            <div style={{ marginBottom: 16 }}>
              <Space wrap size={4}>
                <Tag>源表 {preview.name || preview.datatableId}</Tag>
                <Tag>行数 {preview.sourceRows}</Tag>
                <Tag>表头 {(preview.header || []).join(', ')}</Tag>
              </Space>
              <Table
                size="small"
                rowKey={(_, i) => String(i)}
                pagination={false}
                dataSource={(preview.rows || []).map((r: string[]) => {
                  const header = preview.header as string[];
                  return Object.fromEntries(header.map((h, j) => [h, r[j]]));
                })}
                columns={((preview.header as string[]) || []).map((h) => ({
                  title: h,
                  dataIndex: h,
                  ellipsis: true,
                }))}
              />
            </div>
          )}
          {(!taskMode || taskMode === 'BUILTIN') && (
            <GovernanceConfigFields
              form={taskForm}
              columns={governanceColumnsFromPreview(preview)}
            />
          )}
          {taskMode === 'CUSTOM' && (
            <>
              <Form.Item
                name="script"
                label="Python 脚本"
                rules={[{ required: true }]}
                tooltip="参数：--input 输入 CSV、--output 输出 CSV、--params 参数 JSON；写结果到 --output"
              >
                <Input.TextArea
                  rows={10}
                  placeholder={
                    'import argparse, csv\nap = argparse.ArgumentParser()\nap.add_argument("--input"); ap.add_argument("--output"); ap.add_argument("--params")\na = ap.parse_args()\n...'
                  }
                />
              </Form.Item>
              <Form.Item name="params" label="脚本参数 (JSON)">
                <Input.TextArea rows={2} placeholder='{"seed":1}' />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 任务详情 */}
      <Drawer
        title={`任务详情：${detailItem?.id || ''}`}
        width={640}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {detailItem && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space wrap>
              <Tag color={statusColors[detailItem.status]}>
                {statusLabels[detailItem.status] || detailItem.status}
              </Tag>
              <Tag color={detailItem.exec_mode === 'CUSTOM' ? 'purple' : 'blue'}>
                {execModeLabels[detailItem.exec_mode] || detailItem.exec_mode}
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
            <strong>血缘</strong>
            <Timeline
              items={(detailItem.lineage || []).map((item: DataSandboxRecord) => ({
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
            {detailItem.exec_mode === 'CUSTOM' && detailItem.script_content && (
              <>
                <strong>脚本</strong>
                <pre
                  style={{
                    maxHeight: 300,
                    overflow: 'auto',
                    background: '#f5f5f5',
                    padding: 8,
                  }}
                >
                  {detailItem.script_content}
                </pre>
              </>
            )}
          </Space>
        )}
      </Drawer>

      {/* 结果数据集 */}
      <Modal
        title="结果数据集"
        open={resultsOpen}
        width={860}
        footer={null}
        onCancel={() => setResultsOpen(false)}
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={results}
          pagination={false}
          scroll={{ y: 360 }}
          columns={[
            {
              title: '任务',
              dataIndex: 'id',
              render: (v: string, row: DataSandboxRecord) => row.name || v,
            },
            {
              title: '结果表',
              render: (_: unknown, row: DataSandboxRecord) =>
                `${row.result_node_id}/${row.result_datatable_id}`,
            },
            { title: '行数', dataIndex: 'result_rows' },
            { title: '完成时间', dataIndex: 'finished_at', render: formatTime },
            {
              title: '操作',
              width: 160,
              render: (_: unknown, row: DataSandboxRecord) => (
                <Space wrap>
                  <Button type="link" onClick={() => openResultView(row)}>
                    查看
                  </Button>
                  <Button
                    type="link"
                    onClick={() => setMountTask({ ...row, mountProjectId: '' })}
                  >
                    挂载项目
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      {/* 结果数据展示（仅脱敏后结果可查看；表头携带数据源） */}
      <Drawer
        title={`结果数据：${viewItem?.resultName || viewItem?.resultDatatableId || ''}`}
        width={980}
        open={viewOpen}
        loading={viewLoading}
        onClose={() => setViewOpen(false)}
      >
        {viewItem && (
          <>
            {/* 数据源 / 结果表 头部 */}
            <div
              style={{
                padding: 12,
                borderRadius: 6,
                background: '#f5f7fa',
                marginBottom: 16,
              }}
            >
              <Space wrap size="middle">
                <span>
                  数据源：
                  <Tag color="blue">
                    {viewItem.sourceName || viewItem.sourceDatatableId}（
                    {viewItem.sourceNodeId}/{viewItem.sourceDatatableId}）
                  </Tag>
                </span>
                <span>→</span>
                <span>
                  结果表：
                  <Tag color="green">
                    {viewItem.resultName || viewItem.resultDatatableId}（
                    {viewItem.resultNodeId}/{viewItem.resultDatatableId}）
                  </Tag>
                </span>
                {viewItem.samplingMethod && (
                  <Tag color="cyan">抽样：{viewItem.samplingMethod}</Tag>
                )}
                <Tag color={viewItem.masked ? 'orange' : 'default'}>
                  {viewItem.masked ? '已脱敏' : '未脱敏'}
                </Tag>
                <span>
                  记录数：{viewItem.sourceRows || 0} → {viewItem.resultRows || 0}
                </span>
              </Space>
            </div>

            {viewItem.masked ? (
              <Table
                rowKey={(r, i) => `${i}`}
                size="small"
                dataSource={(viewItem.rows || []).map((r: string[], i: number) => ({
                  __i: i,
                  __row: r,
                }))}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 'max-content' }}
                columns={(viewItem.header || []).map((col: string, i: number) => ({
                  title: col,
                  dataIndex: '__row',
                  width: 140,
                  render: (_: unknown, row: { __row: string[] }) => row.__row[i],
                }))}
              />
            ) : (
              <Alert
                type="warning"
                showIcon
                message="该结果未经脱敏，含真实数据，不予展示"
                description={
                  viewItem.message ||
                  '仅经脱敏（掩码/替换/哈希/取整/空值清除）处理后的结果数据可在此查看；纯抽样或自定义代码输出不在展示范围。'
                }
              />
            )}
          </>
        )}
      </Drawer>

      {/* 挂载项目 */}
      <Modal
        title={`挂载结果到项目：${mountTask?.id || ''}`}
        open={!!mountTask}
        onCancel={() => setMountTask(undefined)}
        onOk={mountResult}
      >
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="选择项目"
          value={mountTask?.mountProjectId}
          onChange={(v) =>
            setMountTask((prev) => (prev ? { ...prev, mountProjectId: v } : prev))
          }
          options={projects.map((p) => ({
            value: p.projectId,
            label: `${p.projectName} (${p.projectId})`,
          }))}
        />
      </Modal>
    </MvpPage>
  );
};
