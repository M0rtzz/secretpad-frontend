import {
  Alert,
  Button,
  DatePicker,
  Form,
  message,
  Modal,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';

import { MvpPage, RefreshButton, formatTime } from '@/modules/data-sandbox-mvp/common';
import {
  DataAssetApi,
  DataComputeApi,
  DataSandboxApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';

export const UsageControlComponent = () => {
  const [assets, setAssets] = useState<DataSandboxRecord[]>([]);
  const [requests, setRequests] = useState<DataSandboxRecord[]>([]);
  const [mountRequests, setMountRequests] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editAsset, setEditAsset] = useState<DataSandboxRecord>();
  const [form] = Form.useForm();
  const asDateTime = (value?: string) => (value ? dayjs(value) : undefined);
  const asTime = (value?: string) => (value ? dayjs(`2000-01-01T${value}`) : undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [assetResponse, requestResponse, mountResponse] = await Promise.all([
        DataAssetApi.catalog({}),
        DataAssetApi.usageRequests({}),
        DataComputeApi.mountRequests(''),
      ]);
      setAssets(responseData(assetResponse, []));
      setRequests(responseData(requestResponse, []));
      setMountRequests(responseData(mountResponse, []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);

  const reviewRequest = async (id: string, action: string) => {
    try {
      responseData(await DataAssetApi.reviewUsageControl({ id, action }), {});
      message.success(action === 'APPROVE' ? '已同意' : '已拒绝');
      refresh();
    } catch (error: any) {
      message.error(error.message || '审批失败');
    }
  };

  const requestColumns = [
    { title: '数据', dataIndex: 'asset_name' },
    { title: '申请节点', dataIndex: 'requester_node_id' },
    { title: '提供方', dataIndex: 'provider_node_id' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag>{v}</Tag> },
    { title: '提交时间', dataIndex: 'created_at', render: formatTime },
    {
      title: '操作',
      render: (_: unknown, row: DataSandboxRecord) =>
        row.direction === 'INCOMING' && row.status === 'PENDING' ? (
          <Space>
            <Button type="link" onClick={() => reviewRequest(row.id, 'APPROVE')}>
              同意
            </Button>
            <Button danger type="link" onClick={() => reviewRequest(row.id, 'REJECT')}>
              拒绝
            </Button>
          </Space>
        ) : (
          '-'
        ),
    },
  ];
  const reviewMount = async (id: string, action: string) => {
    try {
      responseData(
        await DataSandboxApi.approvalAction({
          id,
          action,
          comment: action === 'APPROVE' ? '数据提供方同意挂载' : '数据提供方拒绝挂载',
        }),
        {},
      );
      message.success(action === 'APPROVE' ? '已同意挂载' : '已拒绝挂载');
      refresh();
    } catch (error: any) {
      message.error(error.message || '挂载审批失败');
    }
  };
  const mountColumns = [
    { title: '申请单', dataIndex: 'id' },
    { title: '沙箱', dataIndex: 'sandbox_id' },
    { title: '项目', dataIndex: 'project_id' },
    { title: '申请节点', dataIndex: 'applicant_node_id' },
    {
      title: '数据',
      render: (_: unknown, row: DataSandboxRecord) =>
        (row.payload?.datasetAssetIds || []).join('、') || '-',
    },
    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag>{v}</Tag> },
    { title: '提交时间', dataIndex: 'submitted_at', render: formatTime },
    {
      title: '操作',
      render: (_: unknown, row: DataSandboxRecord) =>
        row.direction === 'INCOMING' && row.status === 'DATA_PROVIDER_REVIEW' ? (
          <Space>
            <Button type="link" onClick={() => reviewMount(row.id, 'APPROVE')}>
              同意
            </Button>
            <Button danger type="link" onClick={() => reviewMount(row.id, 'REJECT')}>
              拒绝
            </Button>
          </Space>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <MvpPage
      title="使用控制"
      description="设置数据有效期、访问时段与结果导出权限"
      extra={<RefreshButton loading={loading} onClick={refresh} />}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="本节点提供的数据可直接设置；其他提供方的数据需提交申请并由提供方确认。"
      />
      <Tabs
        items={[
          {
            key: 'assets',
            label: '数据控制',
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={assets}
                columns={[
                  { title: '数据', dataIndex: 'name' },
                  { title: '提供方', dataIndex: 'provider_node_name' },
                  {
                    title: '类型',
                    dataIndex: 'data_stage',
                    render: (v: string) => <Tag>{v}</Tag>,
                  },
                  { title: '有效期', dataIndex: 'valid_until', render: formatTime },
                  {
                    title: '使用控制',
                    dataIndex: 'usage_control_summary',
                    render: (v: string) => v || '未设置',
                  },
                  {
                    title: '操作',
                    render: (_: unknown, row: DataSandboxRecord) => (
                      <Space>
                        <Button
                          type="link"
                          onClick={() => {
                            setEditAsset(row);
                            form.setFieldsValue({
                              validFrom: asDateTime(row.control_valid_from),
                              validUntil: asDateTime(row.control_valid_until),
                              allowExport: !!row.allow_export,
                              accessStart: asTime(row.access_start),
                              accessEnd: asTime(row.access_end),
                            });
                          }}
                        >
                          设置
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'mine',
            label: '我的申请',
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={requests.filter((r) => r.direction === 'OUTGOING')}
                columns={requestColumns}
              />
            ),
          },
          {
            key: 'review',
            label: '待我审核',
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={requests.filter((r) => r.direction === 'INCOMING')}
                columns={requestColumns}
              />
            ),
          },
          {
            key: 'sandbox-mount',
            label: '沙箱数据挂载审批',
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={mountRequests}
                columns={mountColumns}
                scroll={{ x: 'max-content' }}
              />
            ),
          },
        ]}
      />
      <Modal
        title={`使用控制：${editAsset?.name || ''}`}
        open={!!editAsset}
        onCancel={() => setEditAsset(undefined)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            if (!editAsset) return;
            try {
              const result = responseData(
                await DataAssetApi.saveUsageControl({
                  assetId: editAsset.id,
                  validFrom: values.validFrom?.format('YYYY-MM-DDTHH:mm:ss') || '',
                  validUntil: values.validUntil?.format('YYYY-MM-DDTHH:mm:ss') || '',
                  allowExport: values.allowExport,
                  accessStart: values.accessStart?.format('HH:mm:ss') || '',
                  accessEnd: values.accessEnd?.format('HH:mm:ss') || '',
                }),
                {},
              );
              message.success(
                result.status === 'PENDING' ? '已提交数据提供方审批' : '使用控制已生效',
              );
              setEditAsset(undefined);
              refresh();
            } catch (error: any) {
              message.error(error.message || '设置失败');
            }
          }}
        >
          <Form.Item name="validFrom" label="使用开始时间">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="选择开始日期和时间"
            />
          </Form.Item>
          <Form.Item
            name="validUntil"
            label="使用截止时间"
            dependencies={['validFrom']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const start = getFieldValue('validFrom');
                  return !start || !value || value.isAfter(start)
                    ? Promise.resolve()
                    : Promise.reject(new Error('截止时间必须晚于开始时间'));
                },
              }),
            ]}
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="选择截止日期和时间"
            />
          </Form.Item>
          <Form.Item
            name="allowExport"
            label="允许导出开发结果"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Space>
            <Form.Item name="accessStart" label="每日访问开始">
              <TimePicker format="HH:mm:ss" placeholder="选择开始时分秒" />
            </Form.Item>
            <Form.Item name="accessEnd" label="每日访问结束">
              <TimePicker format="HH:mm:ss" placeholder="选择结束时分秒" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </MvpPage>
  );
};
