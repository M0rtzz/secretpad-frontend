import {
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

import {
  DataGovernanceApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';
import { listProject } from '@/services/secretpad/ProjectController';
import { formatTime, MvpPage, RefreshButton } from '@/modules/data-sandbox-mvp/common';

const samplingMethods = [
  { value: 'RANDOM', label: '随机抽样' },
  { value: 'SYSTEMATIC', label: '等距抽样' },
  { value: 'STRATIFIED', label: '分层抽样' },
  { value: 'CLUSTER', label: '整群抽样' },
];

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

  /* ------------------------------- 详情 / 结果 ------------------------------- */
  const [detailItem, setDetailItem] = useState<DataSandboxRecord>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [results, setResults] = useState<DataSandboxRecord[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [mountTask, setMountTask] = useState<DataSandboxRecord>();
  const [projects, setProjects] = useState<DataSandboxRecord[]>([]);

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
    if (resultsOpen) {
      DataGovernanceApi.results().then((res) => setResults(responseData(res, [])));
      listProject().then((res) => setProjects(responseData(res, [])));
    }
  }, [resultsOpen]);

  const openPolicyCreate = () => {
    setPolicyItem(undefined);
    policyForm.resetFields();
    policyForm.setFieldsValue({
      policyType: 'SAMPLING',
      samplingMethod: 'RANDOM',
      samplingParams: '{"count": 100}',
      maskingColumns: '[]',
    });
    setPolicyOpen(true);
  };

  const openPolicyEdit = (row: DataSandboxRecord) => {
    setPolicyItem(row);
    policyForm.setFieldsValue({
      name: row.name,
      description: row.description || '',
      policyType: row.policy_type,
      samplingMethod: row.sampling_method || '',
      samplingParams: row.sampling_params,
      maskingColumns: row.masking_columns,
    });
    setPolicyOpen(true);
  };

  const savePolicy = async (values: DataSandboxRecord) => {
    try {
      if (policyItem?.id) {
        responseData(
          await DataGovernanceApi.updatePolicy({ id: policyItem.id, ...values }),
          {},
        );
        message.success('策略已更新');
      } else {
        responseData(await DataGovernanceApi.createPolicy(values), {});
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

  const previewSource = async () => {
    const { nodeId, datatableId, limit } = taskForm.getFieldsValue();
    if (!nodeId || !datatableId) {
      message.warning('请先填写源节点与数据表 ID');
      return;
    }
    try {
      setPreview(
        responseData(
          await DataGovernanceApi.preview(nodeId, datatableId, limit || 5),
          {},
        ),
      );
    } catch (error: any) {
      message.error(error.message || '预览失败');
    }
  };

  const submitTask = async (values: DataSandboxRecord) => {
    try {
      responseData(await DataGovernanceApi.submitTask(values), {});
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
      title="数据治理"
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
        width={680}
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
          <Form.Item name="samplingMethod" label="抽样方法">
            <Select allowClear options={samplingMethods} placeholder="不抽样则留空" />
          </Form.Item>
          <Form.Item
            name="samplingParams"
            label="抽样参数 (JSON)"
            tooltip={
              '例如 {"count":100} 或 {"ratio":0.1,"seed":1}；分层需 strataColumns，整群需 clusterColumn/blockSize'
            }
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="maskingColumns"
            label="脱敏列配置 (JSON)"
            tooltip={
              '例如 [{"column":"phone","method":"MASK","params":{"keepLeft":"3","keepRight":"4"}}]'
            }
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务 提交 */}
      <Modal
        title="提交治理任务"
        open={taskOpen}
        width={760}
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
            <Form.Item name="name" label="任务名称">
              <Input placeholder="默认：治理任务-<id>" style={{ width: 220 }} />
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
                dataSource={(preview.rows || []).map((r: string[], i: number) => {
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
            <>
              <Form.Item name="samplingMethod" label="抽样方法">
                <Select
                  allowClear
                  options={samplingMethods}
                  placeholder="留空则按策略或全量"
                />
              </Form.Item>
              <Form.Item name="samplingParams" label="抽样参数 (JSON)">
                <Input.TextArea rows={2} placeholder='{"count":100}' />
              </Form.Item>
              <Form.Item name="maskingColumns" label="脱敏列配置 (JSON)">
                <Input.TextArea
                  rows={3}
                  placeholder='[{"column":"phone","method":"MASK","params":{"keepLeft":"3","keepRight":"4"}}]'
                />
              </Form.Item>
            </>
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
              width: 120,
              render: (_: unknown, row: DataSandboxRecord) => (
                <Button
                  type="link"
                  onClick={() => setMountTask({ ...row, mountProjectId: '' })}
                >
                  挂载项目
                </Button>
              ),
            },
          ]}
        />
      </Modal>

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
