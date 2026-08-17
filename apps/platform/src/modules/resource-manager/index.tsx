import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Progress,
  Space,
  Statistic,
  Table,
  Tag,
} from 'antd';
import { parse } from 'query-string';
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'umi';

import {
  DataSandboxApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';
import {
  formatTime,
  MvpNotice,
  MvpPage,
  RefreshButton,
} from '@/modules/data-sandbox-mvp/common';
import styles from '@/modules/data-sandbox-mvp/index.less';

export const ResourceManagerComponent = () => {
  const ownerId = String(parse(useLocation().search).ownerId || '');
  const [overview, setOverview] = useState<DataSandboxRecord>({
    pools: [],
    quota: {},
    ownerUsage: {},
    gpuInventory: [],
  });
  const [alerts, setAlerts] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [form] = Form.useForm();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [resourceResponse, alertResponse] = await Promise.all([
        DataSandboxApi.resourceOverview(ownerId),
        DataSandboxApi.alerts(),
      ]);
      setOverview(responseData(resourceResponse, {}));
      setAlerts(responseData(alertResponse, []));
    } catch (error: any) {
      message.error(error.message || '加载资源数据失败');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pools = overview.pools || [];
  return (
    <MvpPage
      title="资源管理"
      description="CPU、GPU、内存和存储资源池，配额分配、回收、使用率与告警"
      extra={
        <>
          <RefreshButton loading={loading} onClick={refresh} />
          <Button
            type="primary"
            onClick={() => {
              form.setFieldsValue({
                ownerId: overview.quota?.owner_id || ownerId,
                cpuCores: overview.quota?.cpu_cores,
                memoryGb: overview.quota?.memory_gb,
                gpuCount: overview.quota?.gpu_count,
                storageGb: overview.quota?.storage_gb,
              });
              setQuotaOpen(true);
            }}
          >
            调整配额
          </Button>
        </>
      }
    >
      <MvpNotice />
      <div className={styles.cards}>
        {pools.map((pool: DataSandboxRecord) => (
          <Card key={pool.resource_type}>
            <Statistic
              title={`${pool.resource_type} 资源池`}
              value={pool.used_amount || 0}
              suffix={`/ ${pool.total_amount} ${pool.unit}`}
            />
            <Progress
              percent={pool.usage_percent || 0}
              status={
                (pool.usage_percent || 0) >= pool.warning_threshold
                  ? 'exception'
                  : 'active'
              }
            />
          </Card>
        ))}
      </div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title={`节点配额：${overview.quota?.owner_id || ownerId || '-'}`}>
          <Space size="large" wrap>
            <Statistic
              title="CPU"
              value={overview.ownerUsage?.CPU || 0}
              suffix={`/ ${overview.quota?.cpu_cores || 0} 核`}
            />
            <Statistic
              title="内存"
              value={overview.ownerUsage?.MEMORY || 0}
              suffix={`/ ${overview.quota?.memory_gb || 0} GB`}
            />
            <Statistic
              title="GPU"
              value={overview.ownerUsage?.GPU || 0}
              suffix={`/ ${overview.quota?.gpu_count || 0} A100`}
            />
            <Statistic
              title="存储"
              value={overview.ownerUsage?.STORAGE || 0}
              suffix={`/ ${overview.quota?.storage_gb || 0} GB`}
            />
          </Space>
        </Card>
        <Card title="GPU 库存（MVP 元数据）">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={overview.gpuInventory || []}
            columns={[
              { title: '设备', dataIndex: 'id' },
              { title: '型号', dataIndex: 'model' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: string) => <Tag color="success">{v}</Tag>,
              },
            ]}
          />
        </Card>
        <Card title="资源告警">
          <Table
            rowKey="id"
            size="small"
            dataSource={alerts}
            columns={[
              {
                title: '级别',
                dataIndex: 'severity',
                render: (v: string) => (
                  <Tag color={v === 'CRITICAL' ? 'error' : 'warning'}>{v}</Tag>
                ),
              },
              { title: '来源', dataIndex: 'source' },
              { title: '告警', dataIndex: 'title' },
              { title: '详情', dataIndex: 'detail' },
              { title: '时间', dataIndex: 'created_at', render: formatTime },
              { title: '状态', dataIndex: 'status' },
              {
                title: '操作',
                render: (_: unknown, row: DataSandboxRecord) =>
                  row.status === 'OPEN' && (
                    <Button
                      type="link"
                      onClick={async () => {
                        await DataSandboxApi.resolveAlert(row.id);
                        message.success('告警已处理');
                        refresh();
                      }}
                    >
                      确认恢复
                    </Button>
                  ),
              },
            ]}
          />
        </Card>
      </Space>
      <Modal
        title="调整节点资源配额"
        open={quotaOpen}
        onCancel={() => setQuotaOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              responseData(await DataSandboxApi.saveQuota(values), {});
              message.success('配额已更新');
              setQuotaOpen(false);
              refresh();
            } catch (error: any) {
              message.error(error.message);
            }
          }}
        >
          <Form.Item name="ownerId" label="节点 ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space wrap>
            <Form.Item name="cpuCores" label="CPU（核）">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="memoryGb" label="内存（GB）">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="gpuCount" label="GPU（A100）">
              <InputNumber min={0} max={4} />
            </Form.Item>
            <Form.Item name="storageGb" label="存储（GB）">
              <InputNumber min={1} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </MvpPage>
  );
};
