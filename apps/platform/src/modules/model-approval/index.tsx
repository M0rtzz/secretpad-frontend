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
  Tag,
  Timeline,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  DataSandboxApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';
import {
  formatError,
  formatTime,
  MvpPage,
  RefreshButton,
} from '@/modules/data-sandbox-mvp/common';

const statusLabels: Record<string, string> = {
  MODEL_REVIEW: '待模型审核',
  RESOURCE_REVIEW: '待资源审核',
  APPROVED: '已批准',
  REJECTED: '已驳回',
  PUBLISHED: '已发布',
};

const statusColors: Record<string, string> = {
  MODEL_REVIEW: 'processing',
  RESOURCE_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  PUBLISHED: 'purple',
};

export const ModelApprovalComponent = () => {
  const [items, setItems] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<DataSandboxRecord>();
  const [history, setHistory] = useState<DataSandboxRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form] = Form.useForm();
  const [reviewForm] = Form.useForm();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(responseData(await DataSandboxApi.models({ status, keyword }), []));
    } catch (requestError: unknown) {
      const detail = formatError(requestError, '加载审批列表失败');
      setError(detail);
      message.error(detail);
    } finally {
      setLoading(false);
    }
  }, [status, keyword]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const review = async (values: DataSandboxRecord) => {
    if (!reviewItem) return;
    try {
      responseData(
        await DataSandboxApi.modelAction({ id: reviewItem.id, ...values }),
        {},
      );
      message.success('审批操作完成');
      setReviewItem(undefined);
      reviewForm.resetFields();
      refresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const directAction = async (item: DataSandboxRecord, action: string) => {
    try {
      responseData(await DataSandboxApi.modelAction({ id: item.id, action }), {});
      message.success('操作完成');
      refresh();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  return (
    <MvpPage
      title="模型审批管理"
      description="提交、模型审核、资源审核、驳回、复审、审批记录和版本发布控制"
      error={error}
      onRetry={refresh}
      extra={
        <>
          <RefreshButton loading={loading} onClick={refresh} />
          <Button type="primary" onClick={() => setSubmitOpen(true)}>
            提交模型
          </Button>
        </>
      }
    >
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
        <Input.Search
          placeholder="模型名称或 ID"
          allowClear
          onSearch={setKeyword}
          style={{ width: 280 }}
        />
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={[
          {
            title: '模型名称',
            dataIndex: 'model_name',
            render: (v: string, row: DataSandboxRecord) => (
              <Space direction="vertical" size={0}>
                <strong>{v}</strong>
                <span style={{ color: '#8c8c8c' }}>{row.model_id}</span>
              </Space>
            ),
          },
          { title: '项目', dataIndex: 'project_id', render: (v: string) => v || '-' },
          { title: '版本', dataIndex: 'version', render: (v: number) => `v${v}` },
          {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => (
              <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
            ),
          },
          { title: '当前阶段', dataIndex: 'current_stage' },
          { title: '提交人', dataIndex: 'submitter' },
          { title: '更新时间', dataIndex: 'updated_at', render: formatTime },
          {
            title: '操作',
            width: 260,
            render: (_: unknown, row: DataSandboxRecord) => (
              <Space wrap>
                {['MODEL_REVIEW', 'RESOURCE_REVIEW'].includes(row.status) && (
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
                {row.status === 'REJECTED' && (
                  <Button type="link" onClick={() => directAction(row, 'RESUBMIT')}>
                    提交复审
                  </Button>
                )}
                {row.status === 'APPROVED' && (
                  <Button type="link" onClick={() => directAction(row, 'PUBLISH')}>
                    发布
                  </Button>
                )}
                <Button
                  type="link"
                  onClick={async () => {
                    setHistory(
                      responseData(await DataSandboxApi.modelHistory(row.id), []),
                    );
                    setHistoryOpen(true);
                  }}
                >
                  审批记录
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="提交模型审批"
        open={submitOpen}
        onCancel={() => setSubmitOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              responseData(await DataSandboxApi.submitModel(values), {});
              message.success('已提交模型审核');
              setSubmitOpen(false);
              form.resetFields();
              refresh();
            } catch (error: any) {
              message.error(error.message);
            }
          }}
        >
          <Form.Item name="modelName" label="模型名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="modelId"
            label="数据沙箱模型 ID"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="projectId" label="项目 ID">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="提交说明">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`审批：${reviewItem?.model_name || ''}`}
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
                  label:
                    reviewItem?.status === 'MODEL_REVIEW'
                      ? '模型审核通过，进入资源审核'
                      : '资源审核通过',
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
            color: item.to_status === 'REJECTED' ? 'red' : 'blue',
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
    </MvpPage>
  );
};
