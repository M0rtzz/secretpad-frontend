import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { parse } from 'query-string';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { history, useLocation } from 'umi';

import { DataDevComponent } from '@/modules/data-dev';
import { MvpPage, RefreshButton, formatTime } from '@/modules/data-sandbox-mvp/common';
import { ModelCenterComponent } from '@/modules/model-center';
import {
  DataComputeApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';

const useComputeQuery = () => {
  const query = parse(useLocation().search);
  return {
    ownerId: String(query.ownerId || ''),
    projectId: String(query.projectId || ''),
    sandboxId: String(query.sandboxId || ''),
  };
};

const computeUrl = (tab: string, context: DataSandboxRecord = {}) => {
  const current = new URLSearchParams(window.location.search);
  current.set('tab', tab);
  if (context.projectId) current.set('projectId', context.projectId);
  if (context.sandboxId) current.set('sandboxId', context.sandboxId);
  return `/edge?${current.toString()}`;
};

const ComputeContext = ({
  children,
  requireUse = false,
}: {
  children: (context: DataSandboxRecord) => ReactNode;
  requireUse?: boolean;
}) => {
  const { sandboxId } = useComputeQuery();
  const [context, setContext] = useState<DataSandboxRecord>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!sandboxId) return;
    DataComputeApi.context(sandboxId)
      .then((res) => setContext(responseData(res, {})))
      .catch((e: any) => setError(e.message || '沙箱上下文加载失败'));
  }, [sandboxId]);
  if (!sandboxId)
    return (
      <Result
        status="info"
        title="请先从数据计算首页选择沙箱"
        extra={
          <Button
            type="primary"
            onClick={() => history.push(computeUrl('data-compute-home'))}
          >
            返回数据计算首页
          </Button>
        }
      />
    );
  if (error) return <Result status="error" title={error} />;
  if (!context) return <Card loading />;
  if (requireUse && !context.canUse)
    return (
      <Result
        status="403"
        title="该沙箱仅创建人可使用"
        subTitle="项目其他参与节点可查看沙箱和审批信息，但不能执行计算。"
      />
    );
  return (
    <>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message={`${context.project?.name || context.sandbox?.project_id} / ${
          context.sandbox?.name
        }`}
        description={`沙箱状态：${context.sandbox?.status}；已挂载数据：${
          context.mounts?.length || 0
        } 个`}
        action={
          <Button onClick={() => history.push(computeUrl('data-compute-home'))}>
            切换沙箱
          </Button>
        }
      />
      {children(context)}
    </>
  );
};

export const DataComputeHomeComponent = () => {
  const [projects, setProjects] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [mountSandbox, setMountSandbox] = useState<DataSandboxRecord>();
  const [context, setContext] = useState<DataSandboxRecord>();
  const [form] = Form.useForm();
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(responseData(await DataComputeApi.overview(), []));
    } catch (e: any) {
      message.error(e.message || '加载数据计算项目失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);
  const openMount = async (sandbox: DataSandboxRecord) => {
    try {
      setMountSandbox(sandbox);
      const nextContext = responseData(await DataComputeApi.context(sandbox.id), {});
      setContext(nextContext);
      form.setFieldsValue({
        assetIds: (nextContext.mounts || [])
          .filter((mount: DataSandboxRecord) => mount.status === 'READY')
          .map((mount: DataSandboxRecord) => mount.asset_id),
      });
    } catch (e: any) {
      message.error(e.message || '加载可挂载数据失败');
    }
  };
  return (
    <MvpPage
      title="数据计算首页"
      description="按项目进入本节点可使用的沙箱，管理挂载数据并开展程序计算、数据分析和智能建模"
      extra={<RefreshButton loading={loading} onClick={refresh} />}
    >
      {!projects.length && !loading ? (
        <Empty description="当前节点暂无可计算项目" />
      ) : (
        projects.map((project) => (
          <Card
            key={project.project_id}
            title={project.name}
            style={{ marginBottom: 16 }}
            extra={<Tag>{project.compute_mode}</Tag>}
          >
            <Row gutter={[16, 16]}>
              {(project.sandboxes || []).map((sandbox: DataSandboxRecord) => (
                <Col xs={24} md={12} xl={8} key={sandbox.id}>
                  <Card
                    size="small"
                    title={sandbox.name}
                    extra={
                      <Tag color={sandbox.status === 'RUNNING' ? 'green' : 'default'}>
                        {sandbox.status}
                      </Tag>
                    }
                  >
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="资源">
                        CPU {sandbox.cpu_cores} / 内存 {sandbox.memory_gb}GB / GPU{' '}
                        {sandbox.gpu_count}
                      </Descriptions.Item>
                      <Descriptions.Item label="有效期">
                        {formatTime(sandbox.expires_at)}
                      </Descriptions.Item>
                      <Descriptions.Item label="挂载数据">
                        {sandbox.mount_count || 0} 个
                      </Descriptions.Item>
                      <Descriptions.Item label="计算任务">
                        {sandbox.task_count || 0} 个
                      </Descriptions.Item>
                    </Descriptions>
                    {!sandbox.usable && (
                      <Alert
                        type="warning"
                        showIcon
                        message={sandbox.readOnlyReason || '当前节点只可查看'}
                        style={{ marginBottom: 8 }}
                      />
                    )}
                    <Space wrap>
                      <Button
                        type="primary"
                        disabled={!sandbox.usable}
                        onClick={() =>
                          history.push(
                            computeUrl('data-compute-dev', {
                              projectId: project.project_id,
                              sandboxId: sandbox.id,
                            }),
                          )
                        }
                      >
                        进入沙箱
                      </Button>
                      <Button
                        disabled={!sandbox.usable}
                        onClick={() => openMount(sandbox)}
                      >
                        数据挂载
                      </Button>
                      <Button
                        onClick={() =>
                          history.push(
                            computeUrl('data-compute-report', {
                              projectId: project.project_id,
                              sandboxId: sandbox.id,
                            }),
                          )
                        }
                      >
                        查看报告
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        ))
      )}
      <Modal
        title={`申请挂载数据：${mountSandbox?.name || ''}`}
        open={!!mountSandbox}
        onCancel={() => {
          setMountSandbox(undefined);
          setContext(undefined);
        }}
        onOk={() => form.submit()}
      >
        <Alert
          showIcon
          type="info"
          message="仅可选择项目中的抽样脱敏数据；提交后须经全部项目参与节点同意。"
          style={{ marginBottom: 16 }}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              const result = responseData(
                await DataComputeApi.requestMount({
                  sandboxId: mountSandbox?.id,
                  datasetAssetIds: values.assetIds,
                  reason: values.reason,
                }),
                {},
              );
              message.success(`挂载申请已提交：${result.id}`);
              form.resetFields();
              setMountSandbox(undefined);
              setContext(undefined);
              refresh();
            } catch (e: any) {
              message.error(e.message || '提交挂载申请失败');
            }
          }}
        >
          <Form.Item
            name="assetIds"
            label="抽样脱敏数据"
            rules={[{ required: true, message: '请选择数据' }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={(context?.availableAssets || []).map((a: DataSandboxRecord) => ({
                value: a.id,
                label: `${a.name}（${a.provider_node_name || a.provider_node_id}）`,
              }))}
            />
          </Form.Item>
          <Form.Item name="reason" label="申请说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </MvpPage>
  );
};

export const SandboxDevelopmentComponent = () => (
  <ComputeContext requireUse>{() => <DataDevComponent />}</ComputeContext>
);

export const CustomAlgorithmComponent = () => (
  <ComputeContext requireUse>{() => <ModelCenterComponent />}</ComputeContext>
);

export const ModelingComponentsComponent = () => (
  <ComputeContext>
    {(context) => <ComponentCatalog sandboxId={context.sandbox.id} />}
  </ComputeContext>
);
const ComponentCatalog = ({ sandboxId }: { sandboxId: string }) => {
  const [rows, setRows] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(responseData(await DataComputeApi.components(sandboxId), []));
    } finally {
      setLoading(false);
    }
  }, [sandboxId]);
  useEffect(() => void refresh(), [refresh]);
  return (
    <MvpPage
      title="沙箱智能建模：建模组件"
      description="查看和设置系统内置组件及审批通过的自定义算法组件"
      extra={<RefreshButton loading={loading} onClick={refresh} />}
    >
      <Table
        rowKey={(r) => r.id || r.code}
        dataSource={rows}
        loading={loading}
        columns={[
          { title: '组件', dataIndex: 'name' },
          { title: '分类', dataIndex: 'category' },
          {
            title: '来源',
            dataIndex: 'source',
            render: (v) => (
              <Tag color={v === 'CUSTOM' ? 'purple' : 'blue'}>
                {v === 'CUSTOM' ? '自定义算法' : '系统内置'}
              </Tag>
            ),
          },
          { title: '运行时', dataIndex: 'runtime_app' },
          { title: '版本', dataIndex: 'version' },
          { title: '说明', dataIndex: 'description' },
        ]}
      />
    </MvpPage>
  );
};

export const VisualModelingComponent = () => (
  <ComputeContext requireUse>
    {(context) => <CanvasList context={context} />}
  </ComputeContext>
);
const CanvasList = ({ context }: { context: DataSandboxRecord }) => {
  const [rows, setRows] = useState<DataSandboxRecord[]>([]);
  const [edit, setEdit] = useState<DataSandboxRecord>();
  const [form] = Form.useForm();
  const refresh = useCallback(
    async () =>
      setRows(responseData(await DataComputeApi.canvases(context.sandbox.id), [])),
    [context.sandbox.id],
  );
  useEffect(() => void refresh(), [refresh]);
  const enterDag = (canvas?: DataSandboxRecord) =>
    history.push(
      {
        pathname: '/dag',
        search: `projectId=${context.project.project_id}&sandboxId=${
          context.sandbox.id
        }&mode=${context.project.compute_mode || 'MPC'}&type=DAG${
          canvas ? `&computeCanvasId=${canvas.id}` : ''
        }`,
      },
      { origin: 'data-compute-visual' },
    );
  return (
    <MvpPage
      title="沙箱智能建模：可视化建模"
      description="复用项目建模画布，输入数据限定为当前沙箱已挂载数据"
      extra={
        <Space>
          <Button
            onClick={() => {
              setEdit({});
              form.resetFields();
            }}
          >
            新建画布
          </Button>
          <Button type="primary" onClick={() => enterDag()}>
            进入拖拽建模
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          { title: '画布', dataIndex: 'name' },
          { title: '版本', dataIndex: 'version' },
          { title: '状态', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
          { title: '更新时间', dataIndex: 'updated_at', render: formatTime },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => enterDag(row)}>
                  编辑/执行
                </Button>
                <Button
                  type="link"
                  onClick={() => {
                    setEdit(row);
                    form.setFieldsValue({
                      name: row.name,
                      description: row.description,
                    });
                  }}
                >
                  信息设置
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={edit?.id ? '编辑画布信息' : '新建画布'}
        open={!!edit}
        onCancel={() => setEdit(undefined)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              const saved = responseData(
                await DataComputeApi.saveCanvas({
                  ...values,
                  id: edit?.id,
                  sandboxId: context.sandbox.id,
                  graph: edit?.graph_json
                    ? JSON.parse(edit.graph_json)
                    : { nodes: [], edges: [] },
                }),
                {},
              );
              message.success('画布已保存');
              setEdit(undefined);
              refresh();
              if (!edit?.id) enterDag(saved);
            } catch (e: any) {
              message.error(e.message || '保存失败');
            }
          }}
        >
          <Form.Item name="name" label="画布名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </MvpPage>
  );
};

export const ModelReportsComponent = () => (
  <ComputeContext>
    {(context) => <ReportList sandboxId={context.sandbox.id} />}
  </ComputeContext>
);
const ReportList = ({ sandboxId }: { sandboxId: string }) => {
  const [rows, setRows] = useState<DataSandboxRecord[]>([]);
  const [type, setType] = useState('');
  const [detail, setDetail] = useState<DataSandboxRecord>();
  const refresh = useCallback(
    async () =>
      setRows(responseData(await DataComputeApi.reports(sandboxId, type), [])),
    [sandboxId, type],
  );
  useEffect(() => void refresh(), [refresh]);
  const types = useMemo(
    () => Array.from(new Set(rows.map((r) => r.report_type).filter(Boolean))),
    [rows],
  );
  const exportJson = (row: DataSandboxRecord) => {
    const blob = new Blob([row.payload_json || '{}'], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${row.name || row.id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <MvpPage
      title="沙箱智能建模：模型报告信息"
      description="汇总特征筛选、残差分析、树结构及建模运行报告"
      extra={<RefreshButton onClick={refresh} />}
    >
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          value={type || undefined}
          placeholder="报告类型"
          style={{ width: 220 }}
          options={types.map((v) => ({ value: v, label: v }))}
          onChange={(v) => setType(v || '')}
        />
      </Space>
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          { title: '报告', dataIndex: 'name' },
          { title: '类型', dataIndex: 'report_type', render: (v) => <Tag>{v}</Tag> },
          { title: '画布', dataIndex: 'canvas_id' },
          { title: '运行批次', dataIndex: 'run_id' },
          { title: '生成时间', dataIndex: 'created_at', render: formatTime },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => setDetail(row)}>
                  查看
                </Button>
                <Button type="link" onClick={() => exportJson(row)}>
                  导出 JSON
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        width={900}
        title={detail?.name}
        open={!!detail}
        onCancel={() => setDetail(undefined)}
        footer={null}
      >
        <pre style={{ maxHeight: 600, overflow: 'auto' }}>
          {detail
            ? JSON.stringify(JSON.parse(detail.payload_json || '{}'), null, 2)
            : ''}
        </pre>
      </Modal>
    </MvpPage>
  );
};
