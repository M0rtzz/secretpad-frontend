import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import { useEffect, useState } from 'react';

import { DataComputeApi, responseData } from '@/services/data-sandbox';
import { useModel } from '@/util/valtio-helper';

import { SandboxCanvasView } from './sandbox-canvas.view';

export const NodeDrawer = () => {
  const view = useModel(SandboxCanvasView);
  const nodeId = view.selectedNodeId;
  const drawer = view.drawer;
  const isOutput = drawer === 'output';
  const isLogs = drawer === 'logs';
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!nodeId || (!isOutput && !isLogs)) return;
    const load = async () => {
      setLoading(true);
      try {
        if (isOutput) {
          setOutput(
            responseData(
              await DataComputeApi.canvasNodeOutput(view.canvasId, nodeId, 100),
              {},
            ),
          );
        } else if (isLogs) {
          setLogs(
            responseData(
              await DataComputeApi.canvasNodeLogs(view.canvasId, nodeId),
              {},
            ),
          );
        }
      } catch (e) {
        message.error(String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [nodeId, isOutput, isLogs, view.canvasId]);

  const schema = (output.schema as Record<string, string>[]) || [];
  const rows = (output.rows as unknown[][]) || [];
  const columns = schema.map((c, i) => ({
    title: c.name,
    dataIndex: i,
    width: 140,
    ellipsis: true,
    render: (v: unknown) => (v === null || v === undefined ? '' : String(v)),
  }));

  return (
    <Drawer
      title={isOutput ? '节点输出数据' : '节点日志'}
      width={isOutput ? 760 : 640}
      open={isOutput || isLogs}
      onClose={() => view.closeDrawer()}
      destroyOnClose
      extra={
        <Space>
          {isOutput && (
            <Button
              size="small"
              onClick={() => {
                setOutput({});
              }}
            >
              重新加载
            </Button>
          )}
        </Space>
      }
    >
      <Spin spinning={loading}>
        {isOutput && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="输出表">
                {String(output.tableName || '')}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {output.available ? (
                  <Tag color="green">
                    可用（{String(output.totalRows ?? rows.length)} 行）
                  </Tag>
                ) : (
                  <Tag color="orange">{String(output.message || '无输出')}</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
            {output.available ? (
              <Table
                size="small"
                rowKey={(_, i) => String(i)}
                dataSource={rows}
                columns={columns}
                scroll={{ x: 'max-content', y: 420 }}
                pagination={{ pageSize: 20, showSizeChanger: false }}
              />
            ) : (
              <Empty description={String(output.message || '该节点尚无输出')} />
            )}
          </>
        )}
        {isLogs && (
          <>
            {logs.errorMessage && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="错误信息">
                  <span style={{ color: '#cf1322' }}>{String(logs.errorMessage)}</span>
                </Descriptions.Item>
              </Descriptions>
            )}
            <pre
              style={{
                background: '#f6f6f6',
                padding: 12,
                borderRadius: 4,
                maxHeight: 520,
                overflow: 'auto',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {(logs.logs as { log_text?: string }[])?.length
                ? (logs.logs as { log_text?: string }[])
                    .map((l) => l.log_text || '')
                    .join('\n')
                : '暂无日志'}
            </pre>
          </>
        )}
      </Spin>
    </Drawer>
  );
};
