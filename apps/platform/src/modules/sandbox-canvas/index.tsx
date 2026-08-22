import { ActionType, NodeStatus, Portal, ShowMenuContext } from '@secretflow/dag';
import type { Node } from '@antv/x6';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  ReloadOutlined,
  SaveOutlined,
  StopOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import type { GraphEventHandlerProtocol } from '@secretflow/dag';
import {
  Button,
  Alert,
  Collapse,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Tooltip,
  message,
} from 'antd';
import { parse } from 'query-string';
import { useEffect, useRef, useState } from 'react';
import { history } from 'umi';

import {
  DataComputeApi,
  responseData,
  type DataSandboxRecord,
} from '@/services/data-sandbox';
import { getModel, useModel } from '@/util/valtio-helper';

import { formatTime } from '../data-sandbox-mvp/common';

import { NodeConfigDrawer } from './node-config-drawer';
import { NodeDrawer } from './node-drawer';
import { sandboxDag } from './sandbox-dag';
import { SandboxCanvasView } from './sandbox-canvas.view';
import { TemplateDrawer } from './template-drawer';
import { VersionsDrawer } from './versions-drawer';
import styles from './index.less';

const CATEGORY_ORDER = [
  '数据输入',
  '数据处理',
  '特征工程',
  '统计分析',
  '机器学习',
  '模型评估',
];

const X6ReactPortalProvider = Portal.getProvider();

class SandboxGraphEventHandler implements GraphEventHandlerProtocol {
  onNodeClick = (node: Node) => {
    const data = node.getData();
    if (!data?.codeName) return;
    getModel(SandboxCanvasView).openDrawer('config', data.id);
  };

  onBlankClick = () => {
    getModel(SandboxCanvasView).closeDrawer();
  };
}

const eventHandler = new SandboxGraphEventHandler();

export const SandboxCanvasWorkspace = () => {
  const view = useModel(SandboxCanvasView);
  const containerRef = useRef<HTMLDivElement>(null);
  const { computeCanvasId } = parse(window.location.search) as {
    computeCanvasId?: string;
  };
  const canvasId = computeCanvasId || '';
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelCandidates, setModelCandidates] = useState<DataSandboxRecord[]>([]);
  const [modelForm] = Form.useForm();

  const goBack = () => {
    const current = new URLSearchParams(window.location.search);
    current.set('tab', 'data-compute');
    current.set('workspace', 'visual');
    current.set('projectId', view.projectId);
    current.set('sandboxId', view.sandboxId);
    history.push(`/edge?${current.toString()}`);
  };

  // 初始化画布：canvasId 变化时重建 X6 graph（请求服务指向 data-compute canvas 端点）
  useEffect(() => {
    if (!canvasId) return;
    view.canvasId = canvasId;
    sandboxDag.dispose();
    sandboxDag.addGraphEvents(eventHandler);
    const el = containerRef.current;
    if (!el) return;
    const { clientWidth, clientHeight } = el;
    sandboxDag.init(
      canvasId,
      {
        container: el,
        width: clientWidth || 1000,
        height: clientHeight || 800,
        background: { color: '#f7f9fc' },
      },
      'FULL',
    );
    view.init();
    return () => {
      sandboxDag.dispose();
    };
  }, [canvasId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 画布随容器尺寸缩放
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      const graph = sandboxDag.graphManager.getGraphInstance();
      const el = containerRef.current;
      if (graph && el) graph.resize(el.clientWidth, el.clientHeight);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [canvasId]);

  const exec = (type: ActionType, ...args: unknown[]) => {
    sandboxDag.graphManager.executeAction(type as never, ...args);
  };

  const addNode = async (
    codeName: string,
    label: string,
    params: Record<string, unknown>,
  ) => {
    const graph = sandboxDag.graphManager.getGraphInstance();
    if (!graph) return;
    const maxIdx = await sandboxDag.requestService.getMaxNodeIndex(view.canvasId);
    const nodeId = `${view.canvasId}-node-${maxIdx + 1}`;
    const ports = await sandboxDag.hookService.createPort(nodeId, codeName);
    const outputs = await sandboxDag.hookService.createResult(nodeId, codeName);
    const node = graph.createNode({
      id: nodeId,
      shape: 'dag-node',
      width: 220,
      height: 52,
      x: 60 + (maxIdx % 4) * 250,
      y: 80 + Math.floor((maxIdx % 12) / 4) * 130,
      ports,
      data: {
        id: nodeId,
        codeName,
        label,
        status: NodeStatus.default,
        statusProcess: 0,
        outputs,
        params,
        styles: { variant: 'sandbox' },
      },
    });
    graph.addNode(node);
    sandboxDag.graphManager.executeAction(ActionType.queryStatus as never);
  };

  const startDrag = (codeName: string, label: string, e: React.MouseEvent) => {
    sandboxDag.graphManager.executeAction(
      ActionType.dragNode as never,
      {
        codeName,
        label,
        status: NodeStatus.default,
        statusProcess: 0,
        styles: { variant: 'sandbox' },
      },
      e.nativeEvent,
    );
  };

  const openSaveModel = async () => {
    try {
      await sandboxDag.requestService.explicitSave();
      const candidates = responseData(
        await DataComputeApi.canvasModelCandidates(view.canvasId),
        [],
      );
      setModelCandidates(candidates);
      modelForm.setFieldsValue({
        name: `${String(view.canvas.name || '未命名画布')}-模型`,
        description: String(view.canvas.description || ''),
        modelId: candidates.length === 1 ? candidates[0].model_id : undefined,
      });
      setModelOpen(true);
    } catch (error: any) {
      message.error(error.message || '加载模型信息失败');
    }
  };

  const saveModel = async () => {
    const values = await modelForm.validateFields();
    setModelSaving(true);
    try {
      const saved = responseData(
        await DataComputeApi.saveCanvasModel({
          canvasId: view.canvasId,
          name: values.name,
          description: values.description || '',
          modelId: values.modelId || '',
        }),
        {},
      );
      message.success(
        saved.status === 'READY'
          ? '工作流模型已保存，可在自定义算法中发布 API'
          : '工作流快照已保存；成功运行训练组件后请再次保存为可发布模型',
      );
      setModelOpen(false);
    } catch (error: any) {
      message.error(error.message || '保存模型失败');
    } finally {
      setModelSaving(false);
    }
  };

  const groupedComponents = () => {
    const groups: { category: string; items: DataSandboxRecord[] }[] = [];
    const order = CATEGORY_ORDER;
    order.forEach((cat) => {
      const items = view.components.filter((c) => c.category === cat);
      if (items.length) groups.push({ category: cat, items });
    });
    const rest = view.components.filter((c) => !order.includes(c.category));
    if (rest.length) groups.push({ category: '其他', items: rest });
    return groups;
  };

  const parseDefaults = (op: DataSandboxRecord) => {
    try {
      const parsed = JSON.parse(String(op.default_params_json || '{}'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const leftItems = [
    {
      key: 'components',
      label: '组件库',
      children: (
        <div>
          {view.components.length === 0 && <Empty description="加载中…" />}
          <Collapse
            defaultActiveKey={['数据输入', '数据处理', '特征工程']}
            ghost
            size="small"
            items={groupedComponents().map((g) => ({
              key: g.category,
              label: `${g.category}（${g.items.length}）`,
              children: (
                <List
                  size="small"
                  dataSource={g.items}
                  renderItem={(op) => (
                    <List.Item
                      style={{ cursor: 'grab' }}
                      onMouseDown={(e) =>
                        startDrag(String(op.code), String(op.name), e)
                      }
                      onDoubleClick={() =>
                        addNode(String(op.code), String(op.name), parseDefaults(op))
                      }
                    >
                      <List.Item.Meta
                        title={
                          <Space size={4}>
                            {op.name}
                            {op.train ? <Tag color="green">训练</Tag> : null}
                          </Space>
                        }
                        description={String(op.description || '')}
                      />
                    </List.Item>
                  )}
                />
              ),
            }))}
          />
        </div>
      ),
    },
    {
      key: 'resources',
      label: '数据资源',
      children: (
        <div>
          <Tooltip title="点击挂载表 → 生成数据资源节点（可拖到画布中央）">
            <List
              size="small"
              dataSource={view.resources.filter((r) => r.kind === 'MOUNT')}
              renderItem={(r) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    addNode('data.table', `数据-${String(r.name)}`, {
                      table: r.tableName,
                    })
                  }
                >
                  <List.Item.Meta
                    title={<Tag color="blue">{String(r.name)}</Tag>}
                    description={
                      <span style={{ fontSize: 12 }}>
                        {String(r.tableName)} ·{' '}
                        {Array.isArray(r.columns) ? `${r.columns.length} 列` : ''}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Tooltip>
          <Divider orientation="left" plain>
            画布中间结果（op_*）
          </Divider>
          <List
            size="small"
            dataSource={view.resources.filter((r) => r.kind === 'OPERATOR')}
            renderItem={(r) => (
              <List.Item>
                <List.Item.Meta
                  title={<span style={{ fontSize: 13 }}>{String(r.tableName)}</span>}
                  description={
                    <span style={{ fontSize: 12 }}>
                      {Array.isArray(r.columns) ? `${r.columns.length} 列` : ''}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.back} onClick={goBack}>
          <ArrowLeftOutlined />
        </span>
        <Divider type="vertical" />
        <span className={styles.title}>可视化建模</span>
        <Input
          className={styles.canvasName}
          value={String(view.canvas.name || '')}
          placeholder="画布名称"
          onChange={(e) => view.setCanvas({ ...view.canvas, name: e.target.value })}
        />
        <Tag color="green" style={{ marginLeft: 8 }}>
          v{String(view.canvas.version || 1)}
        </Tag>
        <span className={styles.spacer} />
        <Space size={4}>
          <Tooltip title="保存（生成版本记录）">
            <Button
              size="small"
              icon={<SaveOutlined />}
              onClick={() => sandboxDag.requestService.explicitSave()}
            >
              保存
            </Button>
          </Tooltip>
          <Tooltip title="保存当前工作流拓扑及可执行训练结果">
            <Button size="small" onClick={openSaveModel}>
              保存为模型
            </Button>
          </Tooltip>
          <Tooltip title="整图运行">
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => view.runAll()}
            >
              整图运行
            </Button>
          </Tooltip>
          <Tooltip title="停止运行">
            <Button
              size="small"
              icon={<StopOutlined />}
              onClick={() => view.stopRun()}
            />
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="撤销">
            <Button
              size="small"
              icon={<UndoOutlined />}
              disabled={!view.canUndo()}
              onClick={() => view.undo()}
            />
          </Tooltip>
          <Tooltip title="重做">
            <Button
              size="small"
              icon={<RedoOutlined />}
              disabled={!view.canRedo()}
              onClick={() => view.redo()}
            />
          </Tooltip>
          <Tooltip title="刷新状态">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => view.refreshStatus()}
            />
          </Tooltip>
          <Divider type="vertical" />
          <Button size="small" onClick={() => view.openDrawer('templates')}>
            模板导入
          </Button>
          <Button size="small" onClick={() => view.openDrawer('versions')}>
            版本
          </Button>
          <Button size="small" onClick={() => view.openDrawer('records')}>
            运行记录
          </Button>
        </Space>
      </div>
      <div className={styles.body}>
        <div className={styles.left}>
          <Tabs size="small" items={leftItems} />
        </div>
        <div className={styles.center}>
          <ShowMenuContext.Provider value={false}>
            <X6ReactPortalProvider />
          </ShowMenuContext.Provider>
          <div className={styles.graph} ref={containerRef} />
          <div className={styles.zoomBar}>
            <Tooltip title="放大">
              <Button
                size="small"
                icon={<ZoomInOutlined />}
                onClick={() => exec(ActionType.zoomIn)}
              />
            </Tooltip>
            <Tooltip title="缩小">
              <Button
                size="small"
                icon={<ZoomOutOutlined />}
                onClick={() => exec(ActionType.zoomOut)}
              />
            </Tooltip>
            <Button size="small" onClick={() => exec(ActionType.zoomToFit)}>
              适应画布
            </Button>
          </div>
        </div>
      </div>
      <RecordsDrawer />
      <Modal
        title="保存工作流为模型"
        open={modelOpen}
        confirmLoading={modelSaving}
        onOk={saveModel}
        onCancel={() => setModelOpen(false)}
        destroyOnClose
        width={560}
      >
        {!modelCandidates.length && (
          <Alert
            showIcon
            type="warning"
            style={{ marginBottom: 16 }}
            message="当前没有可发布的训练结果"
            description="可以先保存工作流拓扑；整图运行并成功生成训练模型后，再次保存即可用于 API 发布。"
          />
        )}
        <Form form={modelForm} layout="vertical">
          <Form.Item
            name="name"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="modelId" label="可执行训练结果（发布 API 时必选）">
            <Select
              allowClear
              placeholder="选择该画布成功运行的训练组件输出"
              options={modelCandidates.map((item) => ({
                value: item.model_id,
                label: `${item.name} · ${item.component_code} · ${item.node_id}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="模型说明">
            <Input.TextArea rows={3} maxLength={512} showCount />
          </Form.Item>
        </Form>
      </Modal>
      <NodeConfigDrawer />
      <NodeDrawer />
      <TemplateDrawer />
      <VersionsDrawer />
    </div>
  );
};

const RECORDS_STATUS: Record<string, string> = {
  PENDING: 'default',
  RUNNING: 'processing',
  SUCCEEDED: 'success',
  FAILED: 'error',
  CANCELLED: 'warning',
};

const RecordsDrawer = () => {
  const view = useModel(SandboxCanvasView);
  const refresh = async () => {
    try {
      await view.loadRuns();
    } catch (e) {
      message.error(String(e));
    }
  };
  return (
    <div>
      <div style={{ display: 'none' }}>
        <Button onClick={refresh}>refresh</Button>
      </div>
      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1000,
          maxWidth: 520,
          display: view.drawer === 'records' ? 'block' : 'none',
        }}
      >
        <RecordsPanel />
      </div>
    </div>
  );
};

const RecordsPanel = () => {
  const view = useModel(SandboxCanvasView);
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: 16,
        maxHeight: '60vh',
        overflow: 'auto',
      }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <strong>运行记录</strong>
        <Space>
          <Button size="small" onClick={() => view.loadRuns()}>
            刷新
          </Button>
          <Button size="small" onClick={() => view.closeDrawer()}>
            关闭
          </Button>
        </Space>
      </Space>
      <Divider style={{ margin: '8px 0' }} />
      {view.runs.length === 0 && <Empty description="暂无运行记录" />}
      {view.runs.map((run) => (
        <div key={String(run.id)} style={{ marginBottom: 12 }}>
          <Space wrap>
            <Tag color={RECORDS_STATUS[String(run.status)]}>{String(run.status)}</Tag>
            <span style={{ fontSize: 12 }}>{String(run.mode || 'ALL')}</span>
            <span style={{ fontSize: 12, color: '#999' }}>
              {formatTime(run.started_at)}
            </span>
          </Space>
          <div style={{ marginTop: 4, fontSize: 12 }}>
            {(run.nodeRuns as DataSandboxRecord[] | undefined)?.map((nr) => (
              <Space key={String(nr.id)} size={4} style={{ marginRight: 8 }}>
                <Tag
                  color={RECORDS_STATUS[String(nr.status)]}
                  style={{ marginRight: 0 }}
                >
                  {String(nr.node_id)}
                </Tag>
                <span>{String(nr.status)}</span>
              </Space>
            ))}
          </div>
          {run.error_message && (
            <div style={{ color: '#cf1322', fontSize: 12, marginTop: 4 }}>
              {String(run.error_message)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
