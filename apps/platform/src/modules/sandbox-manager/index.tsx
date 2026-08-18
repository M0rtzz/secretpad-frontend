import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { parse } from 'query-string';
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'umi';

import {
  DataSandboxApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';
import { formatTime, MvpPage, RefreshButton } from '@/modules/data-sandbox-mvp/common';

const statusColors: Record<string, string> = {
  RUNNING: 'success',
  STARTING: 'processing',
  STOPPING: 'processing',
  STOPPED: 'default',
  ERROR: 'error',
  EXPIRED: 'warning',
  DESTROYED: 'default',
};

export const SandboxManagerComponent = () => {
  const { search } = useLocation();
  const ownerId = String(parse(search).ownerId || '');
  const [items, setItems] = useState<DataSandboxRecord[]>([]);
  const [images, setImages] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [form] = Form.useForm();
  const [imageForm] = Form.useForm();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sandboxResponse, imageResponse] = await Promise.all([
        DataSandboxApi.sandboxes({ ownerId }),
        DataSandboxApi.images(),
      ]);
      setItems(responseData(sandboxResponse, []));
      setImages(responseData(imageResponse, []));
    } catch (error: any) {
      message.error(error.message || '加载沙箱失败');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const action = async (id: string, name: string, extra: DataSandboxRecord = {}) => {
    try {
      responseData(
        await DataSandboxApi.sandboxAction({ id, action: name, ...extra }),
        {},
      );
      if (name === 'START') {
        message.info('启动中，约 30 秒内完成（后台同步），可稍后刷新查看状态');
      } else {
        message.success('操作已提交');
      }
      refresh();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 打开开发环境：签发一次性 token 后新标签页跳转跳板地址
  const openDevEndpoint = async (record: DataSandboxRecord) => {
    try {
      const result = responseData(
        await DataSandboxApi.devToken(record.id),
        null as any,
      );
      if (!result || !result.url) throw new Error('签发访问地址失败');
      window.open(result.url, '_blank');
    } catch (error: any) {
      message.error(error.message || '打开开发环境失败');
    }
  };

  const columns = [
    {
      title: '沙箱',
      dataIndex: 'name',
      render: (name: string, record: DataSandboxRecord) => (
        <Space direction="vertical" size={0}>
          <strong>{name}</strong>
          <span style={{ color: '#8c8c8c', fontSize: 12 }}>{record.id}</span>
        </Space>
      ),
    },
    {
      title: '环境镜像',
      dataIndex: 'image_name',
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string, record: DataSandboxRecord) => (
        <Tooltip title={record.last_error || ''}>
          <Tag color={statusColors[value] || 'default'}>{value}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '资源配额',
      render: (_: unknown, record: DataSandboxRecord) =>
        `${record.cpu_cores}C / ${record.memory_gb}GB / GPU ${record.gpu_count} / ${record.storage_gb}GB`,
    },
    {
      title: '网络',
      dataIndex: 'network_policy',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    { title: '到期时间', dataIndex: 'expires_at', render: formatTime },
    {
      title: '端点',
      dataIndex: 'endpoint',
      width: 180,
      render: (value: string) =>
        value ? (
          <Typography.Text copyable={{ text: value }} style={{ fontSize: 12 }}>
            {value}
          </Typography.Text>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      width: 300,
      render: (_: unknown, record: DataSandboxRecord) => (
        <Space wrap>
          {record.status !== 'RUNNING' ? (
            <Button size="small" type="link" onClick={() => action(record.id, 'START')}>
              启动
            </Button>
          ) : (
            <Button size="small" type="link" onClick={() => action(record.id, 'STOP')}>
              停止
            </Button>
          )}
          {record.status === 'RUNNING' && record.endpoint ? (
            <Button
              size="small"
              type="link"
              onClick={() => openDevEndpoint(record)}
              style={{ color: '#1890ff' }}
            >
              打开开发环境
            </Button>
          ) : null}
          <Button
            size="small"
            type="link"
            onClick={() => action(record.id, 'RENEW', { days: 7 })}
          >
            续期7天
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => action(record.id, 'SNAPSHOT')}
          >
            快照
          </Button>
          <Popconfirm
            title="销毁后将回收全部配额，确定继续？"
            onConfirm={() => action(record.id, 'DESTROY')}
          >
            <Button danger size="small" type="link">
              销毁
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <MvpPage
      title="沙箱管理"
      description="环境镜像、生命周期、期限、网络策略、配额和状态监控"
      extra={
        <>
          <RefreshButton loading={loading} onClick={refresh} />
          <Button onClick={() => setImageOpen(true)}>环境镜像</Button>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            创建沙箱
          </Button>
        </>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="创建数据沙箱"
        open={createOpen}
        width={680}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            ownerId,
            validDays: 7,
            networkPolicy: 'INTERNAL_ONLY',
            cpuCores: 2,
            memoryGb: 4,
            gpuCount: 0,
            storageGb: 20,
          }}
          onFinish={async (values) => {
            try {
              responseData(await DataSandboxApi.createSandbox(values), {});
              message.success('沙箱创建成功');
              setCreateOpen(false);
              form.resetFields();
              refresh();
            } catch (error: any) {
              message.error(error.message || '创建失败');
            }
          }}
        >
          <Form.Item name="name" label="沙箱名称" rules={[{ required: true }]}>
            <Input placeholder="例如：客户流失分析环境" />
          </Form.Item>
          <Form.Item name="ownerId" label="所属节点" rules={[{ required: true }]}>
            <Input />
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
            <Form.Item name="gpuCount" label="GPU（A100，仅申请记录）">
              <InputNumber min={0} max={4} />
            </Form.Item>
            <Form.Item name="storageGb" label="存储（GB）">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="validDays" label="有效期（天）">
              <InputNumber min={1} max={365} />
            </Form.Item>
          </Space>
          <Form.Item name="networkPolicy" label="网络策略">
            <Select
              options={[
                { value: 'INTERNAL_ONLY', label: '仅平台内网' },
                { value: 'ALLOW_LIST', label: '出口白名单' },
                { value: 'NO_NETWORK', label: '完全断网' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="环境镜像管理"
        open={imageOpen}
        width={860}
        onCancel={() => setImageOpen(false)}
        footer={null}
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={images}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '镜像地址', dataIndex: 'image_ref' },
            {
              title: 'Kuscia AppImage',
              dataIndex: 'kuscia_app_image',
              render: (v: string) => v || '未配置',
            },
            {
              title: '状态',
              dataIndex: 'enabled',
              render: (v: number) => (
                <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '停用'}</Tag>
              ),
            },
          ]}
        />
        <Form
          form={imageForm}
          layout="inline"
          style={{ marginTop: 20 }}
          initialValues={{ enabled: true }}
          onFinish={async (values) => {
            try {
              responseData(await DataSandboxApi.saveImage(values), {});
              message.success('镜像已保存');
              imageForm.resetFields();
              refresh();
            } catch (error: any) {
              message.error(error.message);
            }
          }}
        >
          <Form.Item name="name" rules={[{ required: true }]}>
            <Input placeholder="镜像名称" />
          </Form.Item>
          <Form.Item name="imageRef" rules={[{ required: true }]}>
            <Input style={{ width: 260 }} placeholder="OCI 镜像地址" />
          </Form.Item>
          <Form.Item name="kusciaAppImage">
            <Input placeholder="Kuscia AppImage" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            新增镜像
          </Button>
        </Form>
      </Modal>
    </MvpPage>
  );
};
