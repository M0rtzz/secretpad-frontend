import {
  Button,
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
  Tooltip,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  DataSandboxApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';
import { formatTime, MvpPage, RefreshButton } from '@/modules/data-sandbox-mvp/common';

const typeLabels: Record<string, string> = {
  CREATE: '创建',
  RENEW: '续期',
  SPEC_CHANGE: '规格变更',
  DATA_CHANGE: '数据挂载变更',
  CONFIG_CHANGE: '配置变更',
  RECYCLE: '回收',
};

const typeColors: Record<string, string> = {
  CREATE: 'blue',
  RENEW: 'cyan',
  SPEC_CHANGE: 'orange',
  RECYCLE: 'red',
};

const statusLabels: Record<string, string> = {
  DATA_PROVIDER_REVIEW: '待项目节点一致审核',
  APPROVED: '已批准',
  EXECUTING: '执行中',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
  FAILED: '失败',
  CANCELLED: '已撤回',
};

const statusColors: Record<string, string> = {
  DATA_PROVIDER_REVIEW: 'processing',
  OPERATOR_REVIEW: 'warning',
  APPROVED: 'success',
  EXECUTING: 'processing',
  COMPLETED: 'success',
  REJECTED: 'error',
  FAILED: 'error',
  CANCELLED: 'default',
};

const REVIEWABLE = ['DATA_PROVIDER_REVIEW'];
const CANCELLABLE = ['DATA_PROVIDER_REVIEW', 'APPROVED'];

export const SandboxApprovalComponent = () => {
  const [items, setItems] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [view, setView] = useState('mine');
  const [reviewItem, setReviewItem] = useState<DataSandboxRecord>();
  const [history, setHistory] = useState<DataSandboxRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detail, setDetail] = useState<DataSandboxRecord>();
  const [reviewForm] = Form.useForm();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        responseData(await DataSandboxApi.approvals({ status, type, keyword }), []),
      );
    } catch (error: any) {
      message.error(error.message || '加载申请单失败');
    } finally {
      setLoading(false);
    }
  }, [status, type, keyword]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const review = async (values: DataSandboxRecord) => {
    if (!reviewItem) return;
    try {
      responseData(
        await DataSandboxApi.approvalAction({ id: reviewItem.id, ...values }),
        {},
      );
      message.success('审批操作完成');
      setReviewItem(undefined);
      reviewForm.resetFields();
      refresh();
    } catch (error: any) {
      message.error(error.message || '审批失败');
    }
  };

  const directAction = async (item: DataSandboxRecord, action: string) => {
    try {
      responseData(await DataSandboxApi.approvalAction({ id: item.id, action }), {});
      message.success('操作完成');
      refresh();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  return (
    <MvpPage
      title="沙箱资源审核"
      description="查看我的申请进度，并审核其他项目节点提交的沙箱资源申请"
      extra={<RefreshButton loading={loading} onClick={refresh} />}
    >
      <Tabs
        activeKey={view}
        onChange={setView}
        items={[
          { key: 'mine', label: '我的申请' },
          { key: 'review', label: '待我审核' },
        ]}
      />
      <Space style={{ marginBottom: 16 }}>
        <Select
          value={status}
          onChange={setStatus}
          style={{ width: 160 }}
          options={[
            { value: '', label: '全部状态' },
            ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          value={type}
          onChange={setType}
          style={{ width: 140 }}
          options={[
            { value: '', label: '全部类型' },
            ...Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Input.Search
          placeholder="申请单 ID 或提交人"
          allowClear
          onSearch={setKeyword}
          style={{ width: 280 }}
        />
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items.filter((item) =>
          view === 'mine'
            ? item.direction !== 'INCOMING'
            : item.direction === 'INCOMING',
        )}
        scroll={{ x: 1100 }}
        columns={[
          {
            title: '申请单',
            dataIndex: 'id',
            render: (id: string, row: DataSandboxRecord) => (
              <Space direction="vertical" size={0}>
                <strong>{id}</strong>
                <span>
                  <Tag color={typeColors[row.approval_type]}>
                    {typeLabels[row.approval_type] || row.approval_type}
                  </Tag>
                </span>
              </Space>
            ),
          },
          {
            title: '沙箱',
            dataIndex: 'sandbox_id',
            render: (v: string) => (v ? v : '-'),
          },
          { title: '所属方', dataIndex: 'owner_id' },
          { title: '所属项目', dataIndex: 'project_id' },
          { title: '提交人', dataIndex: 'submitter' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (v: string, row: DataSandboxRecord) => (
              <Tooltip title={row.last_error || ''}>
                <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
              </Tooltip>
            ),
          },
          {
            title: '重试',
            dataIndex: 'retry_count',
            render: (v: number) => (v > 0 ? `${v} 次` : '-'),
          },
          { title: '提交时间', dataIndex: 'submitted_at', render: formatTime },
          {
            title: '操作',
            width: 240,
            render: (_: unknown, row: DataSandboxRecord) => (
              <Space wrap>
                {view === 'review' && REVIEWABLE.includes(row.status) && (
                  <Button
                    type="link"
                    onClick={() => {
                      setReviewItem(row);
                      reviewForm.setFieldsValue({ action: 'APPROVE' });
                    }}
                  >
                    审批
                  </Button>
                )}
                {view === 'mine' && row.status === 'REJECTED' && (
                  <Button type="link" onClick={() => directAction(row, 'RESUBMIT')}>
                    提交复审
                  </Button>
                )}
                {view === 'mine' && row.status === 'FAILED' && (
                  <Button type="link" onClick={() => directAction(row, 'RETRY')}>
                    重试
                  </Button>
                )}
                {view === 'mine' && CANCELLABLE.includes(row.status) && (
                  <Button type="link" onClick={() => directAction(row, 'CANCEL')}>
                    撤回
                  </Button>
                )}
                <Button
                  type="link"
                  onClick={async () => {
                    setHistory(
                      responseData(await DataSandboxApi.approvalHistory(row.id), []),
                    );
                    setHistoryOpen(true);
                  }}
                >
                  审批记录
                </Button>
                <Button
                  type="link"
                  onClick={async () =>
                    setDetail(
                      responseData(await DataSandboxApi.approvalDetail(row.id), {}),
                    )
                  }
                >
                  详细信息
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={`审批：${reviewItem?.id || ''}（${
          reviewItem ? typeLabels[reviewItem.approval_type] : ''
        }）`}
        open={!!reviewItem}
        onCancel={() => setReviewItem(undefined)}
        onOk={() => reviewForm.submit()}
      >
        <Form form={reviewForm} layout="vertical" onFinish={review}>
          <Form.Item name="action" label="审批结果" rules={[{ required: true }]}>
            <Select
              options={[
                {
                  value: 'APPROVE',
                  label: '本节点审核通过',
                },
                { value: 'REJECT', label: '驳回' },
              ]}
            />
          </Form.Item>
          <Form.Item name="comment" label="审批意见" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="审批记录"
        width={560}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      >
        <Timeline
          items={history.map((item) => ({
            color: ['REJECTED', 'FAILED', 'CANCELLED'].includes(item.to_status)
              ? 'red'
              : 'blue',
            children: (
              <>
                <strong>
                  {item.action}: {item.from_status || '新建'} → {item.to_status}
                </strong>
                <div>
                  {item.operator} · {formatTime(item.created_at)}
                </div>
                <div>{item.comment || '无审批意见'}</div>
              </>
            ),
          }))}
        />
      </Drawer>
      <Drawer
        title="申请详细信息"
        width={680}
        open={!!detail}
        onClose={() => setDetail(undefined)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>申请单：{detail?.id}</div>
          <div>沙箱：{detail?.sandbox_id || '待创建'}</div>
          <div>所属节点 ID：{detail?.applicant_node_id || detail?.owner_id}</div>
          <div>所属项目：{detail?.project_id}</div>
          <div>提交人：{detail?.submitter}</div>
          <div>项目节点投票：</div>
          <Table
            size="small"
            pagination={false}
            rowKey="voter_node_id"
            dataSource={detail?.votes || []}
            columns={[
              { title: '节点', dataIndex: 'voter_node_id' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: string) => <Tag>{v}</Tag>,
              },
              { title: '审核人', dataIndex: 'voter' },
              { title: '意见', dataIndex: 'comment' },
            ]}
          />
          <div>申请参数：</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{detail?.payload_json}</pre>
        </Space>
      </Drawer>
    </MvpPage>
  );
};
