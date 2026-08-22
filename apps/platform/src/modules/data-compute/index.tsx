import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  message,
  Modal,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Menu,
} from 'antd';
import {
  ArrowLeftOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  CodeOutlined,
  FundOutlined,
  PartitionOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { parse } from 'query-string';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { history, useLocation } from 'umi';

import { DataDevComponent } from '@/modules/data-dev';
import { DataAssetPreviewTable } from '@/modules/data-catalog/preview-table';
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

const sandboxListUrl = () => {
  const current = new URLSearchParams(window.location.search);
  current.set('tab', 'data-compute');
  current.delete('sandboxId');
  current.delete('projectId');
  current.delete('workspace');
  return `/edge?${current.toString()}`;
};

const workspaceUrl = (workspace: string, context: DataSandboxRecord) => {
  const current = new URLSearchParams(window.location.search);
  current.set('tab', 'data-compute');
  current.set('workspace', workspace);
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
          <Button type="primary" onClick={() => history.push(sandboxListUrl())}>
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
          <Button onClick={() => history.push(sandboxListUrl())}>切换沙箱</Button>
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
                            workspaceUrl('directory', {
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
                            workspaceUrl('reports', {
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

const WorkspaceDataCatalog = ({ sandboxId }: { sandboxId: string }) => {
  const [data, setData] = useState<DataSandboxRecord>({});
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DataSandboxRecord>();
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(responseData(await DataComputeApi.sandboxDbDirectory(sandboxId), {}));
    } catch (e: any) {
      message.error(e.message || '加载沙箱数据目录失败');
    } finally {
      setLoading(false);
    }
  }, [sandboxId]);
  useEffect(() => void refresh(), [refresh]);
  const previewTable = async (tableName: string) => {
    try {
      const raw = responseData(
        await DataComputeApi.sandboxDbPreview(sandboxId, tableName, 20),
        {},
      );
      const schema: DataSandboxRecord[] = Array.isArray(raw.schema) ? raw.schema : [];
      const names: string[] = schema.map((c) => String(c.name));
      const rows: DataSandboxRecord[] = (raw.rows || []).map((row: string[]) => {
        const obj: DataSandboxRecord = {};
        names.forEach((n, i) => {
          obj[n] = row[i];
        });
        return obj;
      });
      setPreview({
        tableName: raw.tableName || tableName,
        columns: names,
        rows,
        totalRows: raw.totalRows,
        asset: { name: raw.tableName || tableName },
      });
    } catch (e: any) {
      message.error(e.message || '数据预览失败');
    }
  };
  const exportTable = async (tableName: string) => {
    try {
      const blob = await DataComputeApi.sandboxDbTableExport(sandboxId, tableName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success(`已导出 ${tableName}.csv`);
    } catch (e: any) {
      message.error(e.message || '导出失败');
    }
  };
  const mountRows = (data.items || [])
    .filter((r: DataSandboxRecord) => r.kind === 'MOUNT')
    .map((row: DataSandboxRecord) => ({ ...row, _kind: 'mount' }));
  const resultRows = (data.items || [])
    .filter((r: DataSandboxRecord) => r.kind === 'RESULT')
    .map((row: DataSandboxRecord) => ({ ...row, _kind: 'result' }));
  const columns = [
    {
      title: '表名',
      dataIndex: 'tableName',
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: '数据名称',
      dataIndex: 'name',
      render: (_: any, r: DataSandboxRecord) => r.name || r.assetId || '-',
    },
    {
      title: '类型',
      dataIndex: '_kind',
      render: (v: string, r: DataSandboxRecord) => (
        <Tag color={v === 'mount' ? 'blue' : 'green'}>
          {v === 'mount' ? '初始挂载数据' : '计算结果'}
        </Tag>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      render: (v: string) => (
        <Tag color={v === 'SYNCED' ? 'orange' : 'default'}>
          {v === 'SYNCED' ? '跨节点同步' : '本节点'}
        </Tag>
      ),
    },
    {
      title: '行数',
      dataIndex: 'rowCount',
      render: (v: number) => (v == null ? 0 : String(v)),
    },
    {
      title: '查看截止时间',
      dataIndex: 'view_until',
      render: (value: string, row: DataSandboxRecord) =>
        row._kind === 'result' ? formatTime(value) || '长期' : '-',
    },
    {
      title: '导出截止时间',
      dataIndex: 'export_until',
      render: (value: string, row: DataSandboxRecord) =>
        row._kind === 'result' && row.allow_export ? formatTime(value) : '-',
    },
    {
      title: '操作',
      render: (_: any, r: DataSandboxRecord) => (
        <Space>
          <Button
            type="link"
            disabled={!r.tableName || !r.canPreview}
            onClick={() => previewTable(r.tableName)}
          >
            预览
          </Button>
          {r._kind === 'result' && (
            <Button
              type="link"
              disabled={!r.tableName || !r.canExport}
              onClick={() => exportTable(r.tableName)}
            >
              导出开发结果
            </Button>
          )}
        </Space>
      ),
    },
  ];
  return (
    <MvpPage
      title="沙箱数据目录"
      description="查看沙箱权威库 sandbox_data.db 中的挂载初始数据及计算任务产出的结果数据"
      extra={<RefreshButton loading={loading} onClick={refresh} />}
    >
      <Table
        rowKey={(r) => `${r._kind}-${r.tableName}`}
        loading={loading}
        dataSource={[...mountRows, ...resultRows]}
        columns={columns}
        pagination={false}
      />
      <Modal
        width={900}
        title={`数据预览（${preview?.tableName || ''}）`}
        open={!!preview}
        onCancel={() => setPreview(undefined)}
        footer={null}
      >
        <DataAssetPreviewTable preview={preview} />
      </Modal>
    </MvpPage>
  );
};

export const SandboxWorkspaceComponent = () => {
  const { sandboxId, projectId } = useComputeQuery();
  const query = parse(useLocation().search);
  const workspace = String(query.workspace || 'directory');
  const [context, setContext] = useState<DataSandboxRecord>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (sandboxId)
      DataComputeApi.context(sandboxId)
        .then((r) => setContext(responseData(r, {})))
        .catch((e: any) => setError(e.message || '沙箱上下文加载失败'));
  }, [sandboxId]);
  if (!sandboxId) return <DataComputeHomeComponent />;
  if (error) return <Result status="error" title={error} />;
  if (!context) return <Card loading />;
  const c = { sandboxId, projectId: projectId || context.project?.project_id };
  const menu = [
    { key: 'directory', icon: <TableOutlined />, label: '沙箱数据目录' },
    { key: 'dev', icon: <CodeOutlined />, label: '沙箱方式开发' },
    { key: 'algorithm', icon: <FundOutlined />, label: '自定义算法' },
    { key: 'components', icon: <AppstoreOutlined />, label: '建模组件' },
    { key: 'visual', icon: <PartitionOutlined />, label: '可视化建模' },
    { key: 'reports', icon: <BarChartOutlined />, label: '模型报告信息' },
  ];
  const page =
    workspace === 'dev' ? (
      <SandboxDevelopmentComponent />
    ) : workspace === 'algorithm' ? (
      <CustomAlgorithmComponent />
    ) : workspace === 'components' ? (
      <ModelingComponentsComponent />
    ) : workspace === 'visual' ? (
      <VisualModelingComponent />
    ) : workspace === 'reports' ? (
      <ModelReportsComponent />
    ) : (
      <WorkspaceDataCatalog sandboxId={sandboxId} />
    );
  return (
    <Layout style={{ background: 'transparent' }}>
      <Layout.Header
        style={{
          background: '#fff',
          padding: '0 16px',
          height: 'auto',
          lineHeight: 'normal',
        }}
      >
        <Space style={{ padding: '12px 0' }} wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => history.push(sandboxListUrl())}
          >
            返回沙箱列表
          </Button>
          <strong>{context.sandbox?.name}</strong>
          <span>{context.project?.name || c.projectId}</span>
          <Tag color={context.sandbox?.status === 'RUNNING' ? 'green' : 'default'}>
            {context.sandbox?.status}
          </Tag>
          <Tag>CPU {context.sandbox?.cpu_cores}</Tag>
          <Tag>内存 {context.sandbox?.memory_gb}GB</Tag>
          <Tag>GPU {context.sandbox?.gpu_count}</Tag>
        </Space>
      </Layout.Header>
      <Layout style={{ background: 'transparent' }}>
        <Layout.Sider width={190} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[workspace]}
            items={menu}
            onSelect={({ key }) => history.replace(workspaceUrl(key, c))}
          />
        </Layout.Sider>
        <Layout.Content style={{ padding: 16 }}>{page}</Layout.Content>
      </Layout>
    </Layout>
  );
};

export const DataComputeEntryComponent = () => {
  const { sandboxId } = useComputeQuery();
  return sandboxId ? <SandboxWorkspaceComponent /> : <DataComputeHomeComponent />;
};

export const CustomAlgorithmComponent = () => (
  <ComputeContext requireUse>
    {(ctx) => <ModelCenterComponent context={ctx} />}
  </ComputeContext>
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

type WorkflowGraph = {
  nodes: {
    id: string;
    data?: { componentCode?: string; name?: string; params?: DataSandboxRecord };
    position?: { x?: number; y?: number };
  }[];
  edges: { source: string; target: string }[];
};

const workflowGraph = (value: unknown): WorkflowGraph => {
  try {
    const parsed = (
      typeof value === 'string' ? JSON.parse(value || '{}') : value || {}
    ) as DataSandboxRecord;
    return {
      nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
};

const WorkflowTopology = ({ graph }: { graph: WorkflowGraph }) => {
  if (!graph.nodes.length) return <Empty description="工作流拓扑为空" />;
  const nodeWidth = 190;
  const nodeHeight = 52;
  const padding = 36;
  const raw = graph.nodes.map((node, index) => ({
    ...node,
    x: Number(node.position?.x) || (index % 3) * 250,
    y: Number(node.position?.y) || Math.floor(index / 3) * 120,
  }));
  const minX = Math.min(...raw.map((node) => node.x));
  const minY = Math.min(...raw.map((node) => node.y));
  const nodes = raw.map((node) => ({
    ...node,
    x: node.x - minX + padding,
    y: node.y - minY + padding,
  }));
  const positions = new Map(nodes.map((node) => [node.id, node]));
  const width = Math.max(...nodes.map((node) => node.x + nodeWidth)) + padding;
  const height = Math.max(...nodes.map((node) => node.y + nodeHeight)) + padding;
  return (
    <div style={{ overflow: 'auto' }}>
      <svg
        role="img"
        aria-label="工作流组件连接拓扑"
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          minWidth: Math.min(width, 720),
          height: Math.min(Math.max(height, 220), 460),
          border: '1px solid #d9e0e8',
          borderRadius: 8,
          background: '#f7f9fc',
        }}
      >
        <defs>
          <marker
            id="workflow-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#62758a" />
          </marker>
        </defs>
        {graph.edges.map((edge, index) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          if (!source || !target) return null;
          return (
            <line
              key={`${edge.source}-${edge.target}-${index}`}
              x1={source.x + nodeWidth / 2}
              y1={source.y + nodeHeight}
              x2={target.x + nodeWidth / 2}
              y2={target.y}
              stroke="#62758a"
              strokeWidth="2"
              markerEnd="url(#workflow-arrow)"
            />
          );
        })}
        {nodes.map((node) => {
          const name = String(node.data?.name || node.data?.componentCode || node.id);
          const code = String(node.data?.componentCode || '');
          return (
            <g key={node.id}>
              <title>{`${name}${code ? ` (${code})` : ''}`}</title>
              <rect
                x={node.x}
                y={node.y}
                width={nodeWidth}
                height={nodeHeight}
                rx="8"
                fill="#fff"
                stroke="#55708e"
                strokeWidth="1.5"
              />
              <text
                x={node.x + nodeWidth / 2}
                y={node.y + 23}
                textAnchor="middle"
                fill="#1f2937"
                fontSize="14"
                fontWeight="600"
              >
                {name.length > 16 ? `${name.slice(0, 16)}…` : name}
              </text>
              <text
                x={node.x + nodeWidth / 2}
                y={node.y + 41}
                textAnchor="middle"
                fill="#667085"
                fontSize="10"
              >
                {code.length > 24 ? `${code.slice(0, 24)}…` : code}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const WorkflowModelDrawer = ({
  model,
  onClose,
}: {
  model?: DataSandboxRecord;
  onClose: () => void;
}) => {
  const graph = workflowGraph(model?.graph_json);
  const names = new Map(
    graph.nodes.map((node) => [
      node.id,
      String(node.data?.name || node.data?.componentCode || node.id),
    ]),
  );
  return (
    <Drawer title="工作流模型详情" open={!!model} onClose={onClose} width={880}>
      {model && (
        <>
          <Descriptions
            bordered
            size="small"
            column={2}
            items={[
              { key: 'name', label: '模型名称', children: model.name },
              {
                key: 'version',
                label: '画布版本',
                children: `v${model.canvas_version}`,
              },
              {
                key: 'status',
                label: '状态',
                children: (
                  <Tag color={model.status === 'READY' ? 'success' : 'default'}>
                    {model.status === 'READY' ? '可发布 API' : '拓扑草稿'}
                  </Tag>
                ),
              },
              { key: 'model', label: '执行模型 ID', children: model.model_id || '-' },
              { key: 'creator', label: '保存人', children: model.created_by },
              {
                key: 'time',
                label: '保存时间',
                children: formatTime(model.created_at),
              },
              {
                key: 'description',
                label: '说明',
                children: model.description || '-',
                span: 2,
              },
            ]}
          />
          <Divider orientation="left">组件清单</Divider>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={graph.nodes}
            columns={[
              {
                title: '组件名称',
                render: (_, row) => row.data?.name || row.data?.componentCode || row.id,
              },
              { title: '组件编码', render: (_, row) => row.data?.componentCode || '-' },
              { title: '节点 ID', dataIndex: 'id' },
            ]}
          />
          <Divider orientation="left">连接拓扑</Divider>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <WorkflowTopology graph={graph} />
            <Typography.Text type="secondary">
              {graph.edges.length
                ? graph.edges
                    .map(
                      (edge) =>
                        `${names.get(edge.source) || edge.source} → ${
                          names.get(edge.target) || edge.target
                        }`,
                    )
                    .join('；')
                : '该工作流没有组件连线'}
            </Typography.Text>
          </Space>
        </>
      )}
    </Drawer>
  );
};

const CanvasList = ({ context }: { context: DataSandboxRecord }) => {
  const [rows, setRows] = useState<DataSandboxRecord[]>([]);
  const [edit, setEdit] = useState<DataSandboxRecord>();
  const [modelCanvas, setModelCanvas] = useState<DataSandboxRecord>();
  const [canvasModels, setCanvasModels] = useState<DataSandboxRecord[]>([]);
  const [modelDetail, setModelDetail] = useState<DataSandboxRecord>();
  const [modelsLoading, setModelsLoading] = useState(false);
  const [form] = Form.useForm();
  const refresh = useCallback(
    async () =>
      setRows(responseData(await DataComputeApi.canvases(context.sandbox.id), [])),
    [context.sandbox.id],
  );
  useEffect(() => void refresh(), [refresh]);
  const openModels = async (canvas: DataSandboxRecord) => {
    setModelCanvas(canvas);
    setCanvasModels([]);
    setModelsLoading(true);
    try {
      setCanvasModels(responseData(await DataComputeApi.canvasModels(canvas.id), []));
    } catch (e: any) {
      message.error(e.message || '加载工作流模型失败');
    } finally {
      setModelsLoading(false);
    }
  };
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
        <Button
          onClick={() => {
            setEdit({});
            form.resetFields();
          }}
        >
          新建画布
        </Button>
      }
    >
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          { title: '画布', dataIndex: 'name' },
          { title: '版本', dataIndex: 'version' },
          { title: '状态', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
          {
            title: '模型列表',
            render: (_, row) => (
              <Button type="link" onClick={() => openModels(row)}>
                查看模型列表
              </Button>
            ),
          },
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
      <Drawer
        title={`${String(modelCanvas?.name || '')} · 模型列表`}
        open={!!modelCanvas}
        onClose={() => setModelCanvas(undefined)}
        width={760}
      >
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          message="这里展示从该画布显式保存的工作流模型"
          description="READY 模型已关联成功训练的可执行结果，可在自定义算法中发布 API；DRAFT 仅保存工作流拓扑。"
        />
        <Table
          rowKey="id"
          size="small"
          loading={modelsLoading}
          dataSource={canvasModels}
          locale={{ emptyText: '该画布尚未保存工作流模型' }}
          columns={[
            {
              title: '模型',
              dataIndex: 'name',
              render: (value, row) => (
                <Button type="link" onClick={() => setModelDetail(row)}>
                  {value}
                </Button>
              ),
            },
            { title: '画布版本', dataIndex: 'canvas_version', render: (v) => `v${v}` },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v) => (
                <Tag color={v === 'READY' ? 'success' : 'default'}>
                  {v === 'READY' ? '可发布' : '拓扑草稿'}
                </Tag>
              ),
            },
            { title: '保存人', dataIndex: 'created_by' },
            { title: '保存时间', dataIndex: 'created_at', render: formatTime },
          ]}
        />
      </Drawer>
      <WorkflowModelDrawer
        model={modelDetail}
        onClose={() => setModelDetail(undefined)}
      />
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
