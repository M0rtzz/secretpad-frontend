import { ActionType } from '@secretflow/dag';
import {
  AutoComplete,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';

import type { DataSandboxRecord } from '@/services/data-sandbox';
import { useModel } from '@/util/valtio-helper';

import { sandboxDag } from './sandbox-dag';
import { SandboxCanvasView } from './sandbox-canvas.view';

type ParamSchema = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  options?: { value: string; label: string }[];
};

const parseJson = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** 上游数据表列候选：当前节点入边 → 上游 data.table 所选挂载表列（可在其中任选/手填）。 */
const useUpstreamColumns = (nodeId: string): string[] => {
  const view = useModel(SandboxCanvasView);
  const [columns, setColumns] = useState<string[]>([]);
  useEffect(() => {
    const graph = sandboxDag.graphManager.getGraphInstance();
    if (!graph || !nodeId) return;
    const edges = graph.getIncomingEdges(nodeId) || [];
    if (edges.length === 0) {
      setColumns([]);
      return;
    }
    const sourceId = edges[0].getSourceCellId();
    const source = graph.getCellById(sourceId);
    const data = source?.getData?.() || {};
    if (data.codeName === 'data.table' && data.params?.table) {
      setColumns(view.resourceColumns[data.params.table] || []);
    } else {
      setColumns([]);
    }
  }, [nodeId, view.resourceColumns]);
  return columns;
};

export const NodeConfigDrawer = () => {
  const view = useModel(SandboxCanvasView);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const nodeId = view.selectedNodeId;
  const graph = sandboxDag.graphManager.getGraphInstance();
  const node = (nodeId && graph?.getCellById(nodeId)) || null;
  const nodeData = node?.getData?.() || {};
  const codeName = nodeData.codeName || '';

  const operator = useMemo(
    () => view.components.find((c) => c.code === codeName),
    [view.components, codeName],
  );
  const schema: ParamSchema[] = parseJson(
    operator?.parameter_schema_json,
  ) as ParamSchema[];
  const upstreamColumns = useUpstreamColumns(nodeId);

  useEffect(() => {
    if (!node || schema.length === 0) return;
    const currentParams = node.getData().params || {};
    const values: Record<string, unknown> = {};
    schema.forEach((p) => {
      values[p.name] =
        currentParams[p.name] !== undefined ? currentParams[p.name] : p.default;
    });
    form.setFieldsValue(values);
  }, [nodeId, codeName, schema.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const resource = (operator?.resource || {}) as Record<string, string>;

  const renderField = (p: ParamSchema) => {
    const label = (
      <span>
        {p.label}
        {p.required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
      </span>
    );
    switch (p.type) {
      case 'table': {
        // 数据资源节点：选择沙箱已挂载数据表（MOUNT）
        const mountTables = view.resources.filter((r) => r.kind === 'MOUNT');
        return (
          <Form.Item
            key={p.name}
            name={p.name}
            label={label}
            rules={[{ required: p.required }]}
          >
            <Select
              showSearch
              placeholder="选择沙箱已挂载数据表"
              optionFilterProp="label"
              options={mountTables.map((r) => ({
                label: `${r.name}（${r.tableName}）`,
                value: r.tableName,
              }))}
            />
          </Form.Item>
        );
      }
      case 'select':
        return (
          <Form.Item key={p.name} name={p.name} label={label}>
            <Select
              options={(p.options || []).map((o) => ({
                label: o.label,
                value: o.value,
              }))}
            />
          </Form.Item>
        );
      case 'columns':
        return (
          <Form.Item key={p.name} name={p.name} label={label}>
            <Select
              mode="tags"
              open={false}
              suffixIcon={null}
              tokenSeparators={[',']}
              placeholder={
                upstreamColumns.length
                  ? '选择或输入列名（可多选）'
                  : '输入列名（逗号分隔）'
              }
            />
          </Form.Item>
        );
      case 'column':
        return (
          <Form.Item
            key={p.name}
            name={p.name}
            label={label}
            rules={[{ required: p.required }]}
          >
            <AutoComplete
              options={upstreamColumns.map((c) => ({ value: c }))}
              placeholder="选择或输入列名"
            />
          </Form.Item>
        );
      case 'boolean':
        return (
          <Form.Item key={p.name} name={p.name} label={label} valuePropName="checked">
            <Switch />
          </Form.Item>
        );
      case 'integer':
        return (
          <Form.Item key={p.name} name={p.name} label={label}>
            <InputNumber precision={0} style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={p.name} name={p.name} label={label}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'expr':
        return (
          <Form.Item
            key={p.name}
            name={p.name}
            label={label}
            rules={[{ required: p.required }]}
          >
            <Input.TextArea rows={2} placeholder="如 balance > 20000" />
          </Form.Item>
        );
      case 'hidden_layer':
        return (
          <Form.Item key={p.name} name={p.name} label={label}>
            <Input placeholder="(32,16)" />
          </Form.Item>
        );
      case 'string':
      default:
        return (
          <Form.Item
            key={p.name}
            name={p.name}
            label={label}
            rules={[{ required: p.required }]}
          >
            <Input />
          </Form.Item>
        );
    }
  };

  const onSave = async () => {
    if (!node) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const params = { ...(node.getData().params || {}) };
      Object.entries(values).forEach(([k, v]) => {
        params[k] = v;
      });
      sandboxDag.graphManager.executeAction(ActionType.changeNodeData, nodeId, {
        params,
      });
      message.success('节点配置已保存');
    } catch (e) {
      message.error('配置校验失败，请检查必填项');
    } finally {
      setSaving(false);
    }
  };

  const runSingle = () => {
    view.openDrawer('');
    view.runNode(nodeId);
  };

  return (
    <Drawer
      title="节点配置"
      width={420}
      open={view.drawer === 'config'}
      onClose={() => view.closeDrawer()}
      extra={
        <Space>
          <Button onClick={() => view.closeDrawer()}>取消</Button>
          <Button type="primary" loading={saving} onClick={onSave}>
            保存配置
          </Button>
        </Space>
      }
      destroyOnClose
    >
      {!node && <div>请选择节点</div>}
      {node && (
        <>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="节点名称">{nodeData.label}</Descriptions.Item>
            <Descriptions.Item label="算子">
              {operator?.name || codeName}
            </Descriptions.Item>
            {resource.cpu && (
              <Descriptions.Item label="资源配额">
                {resource.cpu} C / {resource.memory}
              </Descriptions.Item>
            )}
          </Descriptions>
          {operator?.description && (
            <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
              {operator.description}
            </Typography.Paragraph>
          )}
          <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
            {schema.map((p) => renderField(p))}
          </Form>
          <div>
            <Typography.Text strong>输入 Schema</Typography.Text>
            <div style={{ margin: '4px 0 12px' }}>
              {parseJson(operator?.input_schema_json).map((c, i) => (
                <Tag key={i} color="blue">
                  {String((c as DataSandboxRecord).name || '*')}
                  {c && (c as DataSandboxRecord).description
                    ? `：${(c as DataSandboxRecord).description}`
                    : ''}
                </Tag>
              ))}
            </div>
            <Typography.Text strong>输出 Schema</Typography.Text>
            <div style={{ margin: '4px 0 12px' }}>
              {parseJson(operator?.output_schema_json).map((c, i) => (
                <Tag key={i} color="green">
                  {String((c as DataSandboxRecord).name || '*')}
                </Tag>
              ))}
            </div>
          </div>
          <Button
            block
            icon={<span>▶</span>}
            onClick={runSingle}
            style={{ marginTop: 8 }}
          >
            测试执行（单节点）
          </Button>
        </>
      )}
    </Drawer>
  );
};
