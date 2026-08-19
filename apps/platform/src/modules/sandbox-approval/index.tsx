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
  RECYCLE: '回收',
};

const typeColors: Record<string, string> = {
  CREATE: 'blue',
  RENEW: 'cyan',
  SPEC_CHANGE: 'orange',
  RECYCLE: 'red',
};

const statusLabels: Record<string, string> = {
  DATA_PROVIDER_REVIEW: '待供数方审核',
  OPERATOR_REVIEW: '待运营方审核',
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

const REVIEWABLE = ['DATA_PROVIDER_REVIEW', 'OPERATOR_REVIEW'];
const CANCELLABLE = ['DATA_PROVIDER_REVIEW', 'OPERATOR_REVIEW', 'APPROVED'];

export const SandboxApprovalComponent = () => {
  const [items, setItems] = useState<DataSandboxRecord[]>([]);
  const [images, setImages] = useState<DataSandboxRecord[]>([]);
  const [sandboxes, setSandboxes] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<DataSandboxRecord>();
  const [history, setHistory] = useState<DataSandboxRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const approvalType = Form.useWatch('approvalType', form);

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

  useEffect(() => {
    DataSandboxApi.images().then((res) => setImages(responseData(res, [])));
    DataSandboxApi.sandboxes({}).then((res) =>
      setSandboxes(
        responseData(res, []).filter((s: DataSandboxRecord) => s.deleted === 0),
      ),
    );
  }, []);

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

  const openSubmit = () => {
    form.resetFields();
    setSubmitOpen(true);
  };

  return (
    <MvpPage
      title="沙箱申请审批"
      description="创建、续期、规格变更与回收的申请单提交，供数方/运营方两级审核、驳回复审、失败重试与审批记录"
      extra={
        <>
          <RefreshButton loading={loading} onClick={refresh} />
          <Button type="primary" onClick={openSubmit}>
            提交申请
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
        dataSource={items}
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
                {REVIEWABLE.includes(row.status) && (
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
                {row.status === 'FAILED' && (
                  <Button type="link" onClick={() => directAction(row, 'RETRY')}>
                    重试
                  </Button>
                )}
                {CANCELLABLE.includes(row.status) && (
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
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="提交沙箱资源申请"
        open={submitOpen}
        width={680}
        onCancel={() => setSubmitOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            approvalType: 'CREATE',
            validDays: 7,
            networkPolicy: 'INTERNAL_ONLY',
          }}
          onFinish={async (values) => {
            try {
              responseData(await DataSandboxApi.approvalSubmit(values), {});
              message.success('申请已提交，等待审批');
              setSubmitOpen(false);
              form.resetFields();
              refresh();
            } catch (error: any) {
              message.error(error.message || '提交失败');
            }
          }}
        >
          <Form.Item name="approvalType" label="申请类型" rules={[{ required: true }]}>
            <Select
              options={Object.entries(typeLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          {approvalType && approvalType !== 'CREATE' && (
            <Form.Item name="sandboxId" label="目标沙箱" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={sandboxes.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.id})`,
                }))}
              />
            </Form.Item>
          )}
          {(!approvalType || approvalType === 'CREATE') && (
            <>
              <Form.Item name="name" label="沙箱名称" rules={[{ required: true }]}>
                <Input placeholder="例如：客户流失分析环境" />
              </Form.Item>
              <Form.Item name="imageId" label="环境镜像" rules={[{ required: true }]}>
                <Select
                  options={images
                    .filter((item) => item.enabled)
                    .map((item) => ({
                      value: item.id,
                      label: `${item.name} (${item.image_ref})`,
                    }))}
                />
              </Form.Item>
              <Space size="large" wrap>
                <Form.Item name="cpuCores" label="CPU（核）">
                  <InputNumber min={0.1} />
                </Form.Item>
                <Form.Item name="memoryGb" label="内存（GB）">
                  <InputNumber min={1} />
                </Form.Item>
                <Form.Item name="gpuCount" label="GPU">
                  <InputNumber min={0} max={4} />
                </Form.Item>
                <Form.Item name="storageGb" label="存储（GB）">
                  <InputNumber min={1} />
                </Form.Item>
                <Form.Item name="validDays" label="有效期（天）">
                  <InputNumber min={1} max={365} />
                </Form.Item>
              </Space>
            </>
          )}
          {approvalType === 'RENEW' && (
            <Form.Item name="days" label="续期天数" rules={[{ required: true }]}>
              <InputNumber min={1} max={365} />
            </Form.Item>
          )}
          {approvalType === 'SPEC_CHANGE' && (
            <Space size="large" wrap>
              <Form.Item name="cpuCores" label="新 CPU（核）">
                <InputNumber min={0.1} />
              </Form.Item>
              <Form.Item name="memoryGb" label="新内存（GB）">
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="gpuCount" label="新 GPU">
                <InputNumber min={0} max={4} />
              </Form.Item>
              <Form.Item name="storageGb" label="新存储（GB）">
                <InputNumber min={1} />
              </Form.Item>
            </Space>
          )}
          <Form.Item name="reason" label="申请原因">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

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
                  label:
                    reviewItem?.status === 'DATA_PROVIDER_REVIEW'
                      ? '供数方审核通过，进入运营方审核'
                      : '运营方审核通过，自动执行',
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
    </MvpPage>
  );
};
