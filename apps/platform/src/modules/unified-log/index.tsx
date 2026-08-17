import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  DataSandboxApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';
import {
  formatTime,
  MvpPage,
  RefreshButton,
  saveBlob,
} from '@/modules/data-sandbox-mvp/common';

const logTypes = ['OPERATION', 'AUDIT', 'LOGIN', 'SYSTEM'];

export const UnifiedLogComponent = () => {
  const [items, setItems] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('');
  const [level, setLevel] = useState('');
  const [keyword, setKeyword] = useState('');
  const [retention, setRetention] = useState<DataSandboxRecord[]>([]);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [form] = Form.useForm();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [logs, policies] = await Promise.all([
        DataSandboxApi.logs({ type, level, keyword, limit: 1000 }),
        DataSandboxApi.retention(),
      ]);
      setItems(responseData(logs, []));
      setRetention(responseData(policies, []));
    } catch (error: any) {
      message.error(error.message || '日志加载失败');
    } finally {
      setLoading(false);
    }
  }, [type, level, keyword]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MvpPage
      title="统一日志"
      description="操作、审计、登录和系统日志的检索、导出与留存策略"
      extra={
        <>
          <RefreshButton loading={loading} onClick={refresh} />
          <Button onClick={() => setRetentionOpen(true)}>留存策略</Button>
          <Button
            type="primary"
            onClick={async () => {
              try {
                saveBlob(
                  await DataSandboxApi.exportLogs({ type, keyword }),
                  `data-sandbox-logs-${Date.now()}.csv`,
                );
              } catch (error: any) {
                message.error(error.message);
              }
            }}
          >
            导出 CSV
          </Button>
        </>
      }
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={type}
          onChange={setType}
          style={{ width: 150 }}
          options={[
            { value: '', label: '全部日志' },
            ...logTypes.map((value) => ({ value, label: value })),
          ]}
        />
        <Select
          value={level}
          onChange={setLevel}
          style={{ width: 130 }}
          options={[
            { value: '', label: '全部级别' },
            ...['INFO', 'WARN', 'ERROR'].map((value) => ({ value, label: value })),
          ]}
        />
        <Input.Search
          allowClear
          placeholder="动作、资源 ID 或详情"
          onSearch={setKeyword}
          style={{ width: 320 }}
        />
      </Space>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={items}
        scroll={{ x: 1200 }}
        columns={[
          {
            title: '类型',
            dataIndex: 'log_type',
            render: (v: string) => <Tag>{v}</Tag>,
          },
          {
            title: '级别',
            dataIndex: 'level',
            render: (v: string) => (
              <Tag color={v === 'ERROR' ? 'error' : v === 'WARN' ? 'warning' : 'blue'}>
                {v}
              </Tag>
            ),
          },
          { title: '操作人', dataIndex: 'actor' },
          { title: '动作', dataIndex: 'action' },
          {
            title: '资源',
            render: (_: unknown, row: DataSandboxRecord) =>
              `${row.resource_type || '-'} / ${row.resource_id || '-'}`,
          },
          {
            title: '结果',
            dataIndex: 'success',
            render: (v: number) => (
              <Tag color={v ? 'success' : 'error'}>{v ? '成功' : '失败'}</Tag>
            ),
          },
          { title: 'IP', dataIndex: 'ip_address' },
          { title: '时间', dataIndex: 'created_at', render: formatTime },
          { title: '详情', dataIndex: 'detail', ellipsis: true, width: 260 },
        ]}
      />
      <Modal
        title="日志留存策略"
        open={retentionOpen}
        onCancel={() => setRetentionOpen(false)}
        footer={null}
      >
        <Table
          rowKey="log_type"
          size="small"
          pagination={false}
          dataSource={retention}
          columns={[
            { title: '日志类型', dataIndex: 'log_type' },
            { title: '留存天数', dataIndex: 'retention_days' },
            { title: '更新人', dataIndex: 'updated_by' },
          ]}
        />
        <Form
          form={form}
          layout="inline"
          style={{ marginTop: 20 }}
          onFinish={async (values) => {
            try {
              await DataSandboxApi.saveRetention(values);
              message.success('策略已保存');
              form.resetFields();
              refresh();
            } catch (error: any) {
              message.error(error.message);
            }
          }}
        >
          <Form.Item name="logType" rules={[{ required: true }]}>
            <Select
              placeholder="日志类型"
              style={{ width: 140 }}
              options={logTypes.map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item name="retentionDays" rules={[{ required: true }]}>
            <InputNumber min={1} placeholder="天数" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
    </MvpPage>
  );
};
