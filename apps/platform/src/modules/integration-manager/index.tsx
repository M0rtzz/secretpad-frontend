import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

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

export const IntegrationManagerComponent = () => {
  const [data, setData] = useState<DataSandboxRecord>({
    clients: [],
    webhooks: [],
    deliveries: [],
    oidc: {},
  });
  const [loading, setLoading] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [credential, setCredential] = useState<DataSandboxRecord>();
  const [clientForm] = Form.useForm();
  const [webhookForm] = Form.useForm();
  const [oidcForm] = Form.useForm();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = responseData(await DataSandboxApi.integrations(), {});
      setData(next);
      oidcForm.setFieldsValue({
        issuer: next.oidc?.issuer,
        clientId: next.oidc?.client_id,
        scopes: next.oidc?.scopes,
        enabled: !!next.oidc?.enabled,
      });
    } catch (error: any) {
      message.error(error.message || '加载对接配置失败');
    } finally {
      setLoading(false);
    }
  }, [oidcForm]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MvpPage
      title="系统对接"
      description="API 文档、调用凭证、回调、同步记录、失败重试与 OIDC 配置测试"
      extra={<RefreshButton loading={loading} onClick={refresh} />}
    >
      <MvpNotice />
      <Tabs
        items={[
          {
            key: 'api',
            label: 'API 与凭证',
            children: (
              <>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={2} title="OpenAPI 文档">
                    <Descriptions.Item label="Swagger UI">
                      <Typography.Link
                        href={data.openapi || '/swagger-ui/index.html'}
                        target="_blank"
                      >
                        打开接口文档
                      </Typography.Link>
                    </Descriptions.Item>
                    <Descriptions.Item label="OpenAPI JSON">
                      <Typography.Link
                        href={data.openapiJson || '/v3/api-docs'}
                        target="_blank"
                      >
                        下载定义
                      </Typography.Link>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
                <div style={{ marginBottom: 12, textAlign: 'right' }}>
                  <Button type="primary" onClick={() => setClientOpen(true)}>
                    创建调用凭证
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  dataSource={data.clients || []}
                  columns={[
                    { title: '名称', dataIndex: 'name' },
                    { title: 'Client ID', dataIndex: 'client_id' },
                    { title: '权限范围', dataIndex: 'scopes' },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      render: (v: number) => (
                        <Tag color={v ? 'success' : 'default'}>
                          {v ? '启用' : '已吊销'}
                        </Tag>
                      ),
                    },
                    { title: '创建时间', dataIndex: 'created_at', render: formatTime },
                    {
                      title: '操作',
                      render: (_: unknown, row: DataSandboxRecord) =>
                        !!row.enabled && (
                          <Button
                            danger
                            type="link"
                            onClick={async () => {
                              await DataSandboxApi.revokeClient(row.id);
                              message.success('凭证已吊销');
                              refresh();
                            }}
                          >
                            吊销
                          </Button>
                        ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'webhook',
            label: 'Webhook 回调',
            children: (
              <>
                <div style={{ marginBottom: 12, textAlign: 'right' }}>
                  <Button type="primary" onClick={() => setWebhookOpen(true)}>
                    新增 Webhook
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  dataSource={data.webhooks || []}
                  columns={[
                    { title: '名称', dataIndex: 'name' },
                    { title: '地址', dataIndex: 'url', ellipsis: true },
                    { title: '订阅事件', dataIndex: 'events' },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      render: (v: number) => (
                        <Tag color={v ? 'success' : 'default'}>
                          {v ? '启用' : '停用'}
                        </Tag>
                      ),
                    },
                    {
                      title: '操作',
                      render: (_: unknown, row: DataSandboxRecord) => (
                        <Button
                          type="link"
                          onClick={async () => {
                            try {
                              const result = responseData(
                                await DataSandboxApi.testWebhook(row.id),
                                {},
                              );
                              message[
                                result.status === 'SUCCESS' ? 'success' : 'error'
                              ](`回调测试：${result.status}`);
                              refresh();
                            } catch (error: any) {
                              message.error(error.message);
                            }
                          }}
                        >
                          测试
                        </Button>
                      ),
                    },
                  ]}
                />
                <Typography.Title level={5}>同步与投递记录</Typography.Title>
                <Table
                  rowKey="id"
                  size="small"
                  dataSource={data.deliveries || []}
                  columns={[
                    { title: '事件', dataIndex: 'event_type' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: (v: string) => (
                        <Tag color={v === 'SUCCESS' ? 'success' : 'error'}>{v}</Tag>
                      ),
                    },
                    { title: '尝试次数', dataIndex: 'attempts' },
                    { title: 'HTTP', dataIndex: 'response_code' },
                    { title: '时间', dataIndex: 'updated_at', render: formatTime },
                    {
                      title: '操作',
                      render: (_: unknown, row: DataSandboxRecord) =>
                        row.status === 'FAILED' && (
                          <Button
                            type="link"
                            onClick={async () => {
                              await DataSandboxApi.retryDelivery(row.id);
                              message.success('已执行重试');
                              refresh();
                            }}
                          >
                            重试
                          </Button>
                        ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'oidc',
            label: 'SSO / OIDC',
            children: (
              <Card title="OIDC 配置与发现测试">
                <Alert
                  type="warning"
                  showIcon
                  message="MVP 仅保存配置并测试 Discovery，不替换当前数据沙箱登录链路。"
                  style={{ marginBottom: 16 }}
                />
                <Form
                  form={oidcForm}
                  layout="vertical"
                  onFinish={async (values) => {
                    try {
                      responseData(await DataSandboxApi.saveOidc(values), {});
                      message.success('OIDC 配置已保存');
                      refresh();
                    } catch (error: any) {
                      message.error(error.message);
                    }
                  }}
                >
                  <Form.Item
                    name="issuer"
                    label="Issuer URL"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="https://idp.example.com/realms/data" />
                  </Form.Item>
                  <Form.Item name="clientId" label="Client ID">
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="clientSecret"
                    label={`Client Secret${
                      data.oidc?.has_client_secret ? '（已配置，留空不修改）' : ''
                    }`}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Form.Item name="scopes" label="Scopes">
                    <Input />
                  </Form.Item>
                  <Form.Item name="enabled" label="启用配置" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      保存配置
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          const result = responseData(
                            await DataSandboxApi.testOidc(),
                            {},
                          );
                          message[result.status === 'SUCCESS' ? 'success' : 'error'](
                            result.message || result.status,
                          );
                          refresh();
                        } catch (error: any) {
                          message.error(error.message);
                        }
                      }}
                    >
                      测试连接
                    </Button>
                  </Space>
                </Form>
                <pre className={styles.code}>
                  {data.oidc?.discovery_message || '尚未执行 Discovery 测试'}
                </pre>
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="创建 API 调用凭证"
        open={clientOpen}
        onCancel={() => setClientOpen(false)}
        onOk={() => clientForm.submit()}
      >
        <Form
          form={clientForm}
          layout="vertical"
          initialValues={{ scopes: 'sandbox:read sandbox:write' }}
          onFinish={async (values) => {
            try {
              const result = responseData(
                await DataSandboxApi.createClient(values),
                {},
              );
              setCredential(result);
              setClientOpen(false);
              clientForm.resetFields();
              refresh();
            } catch (error: any) {
              message.error(error.message);
            }
          }}
        >
          <Form.Item name="name" label="凭证名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scopes" label="权限范围">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="调用凭证（仅显示一次）"
        open={!!credential}
        onCancel={() => setCredential(undefined)}
        footer={
          <Button type="primary" onClick={() => setCredential(undefined)}>
            我已保存
          </Button>
        }
      >
        <Alert type="warning" showIcon message="关闭后无法再次查看 Client Secret。" />
        <pre className={styles.code}>{`Client ID: ${
          credential?.client_id || ''
        }\nClient Secret: ${credential?.client_secret || ''}`}</pre>
      </Modal>
      <Modal
        title="新增 Webhook"
        open={webhookOpen}
        onCancel={() => setWebhookOpen(false)}
        onOk={() => webhookForm.submit()}
      >
        <Form
          form={webhookForm}
          layout="vertical"
          initialValues={{ events: 'sandbox.created,model.published', enabled: true }}
          onFinish={async (values) => {
            try {
              responseData(await DataSandboxApi.saveWebhook(values), {});
              message.success('Webhook 已保存');
              setWebhookOpen(false);
              webhookForm.resetFields();
              refresh();
            } catch (error: any) {
              message.error(error.message);
            }
          }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="url"
            label="回调地址"
            rules={[{ required: true, type: 'url' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="events" label="事件（逗号分隔，* 表示全部）">
            <Input />
          </Form.Item>
          <Form.Item name="secret" label="签名密钥">
            <Input.Password />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </MvpPage>
  );
};
