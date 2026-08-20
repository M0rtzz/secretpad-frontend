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
  DataAssetApi,
  DataSandboxApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';
import API from '@/services/secretpad';
import { formatTime, MvpPage, RefreshButton } from '@/modules/data-sandbox-mvp/common';
import { LoginService } from '@/modules/login/login.service';
import { useModel } from '@/util/valtio-helper';
import { checkAllApproved } from '@/modules/p2p-project-list/components/common';

const statusColors: Record<string, string> = {
  RUNNING: 'success',
  STARTING: 'processing',
  STOPPING: 'processing',
  STOPPED: 'default',
  ERROR: 'error',
  EXPIRED: 'warning',
  DESTROYED: 'default',
};

const formatError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const SandboxManagerComponent = () => {
  const { search } = useLocation();
  const ownerId = String(parse(search).ownerId || '');
  const loginService = useModel(LoginService);
  const currentUser = loginService?.userInfo as DataSandboxRecord | undefined;
  const currentNodeId = String(currentUser?.platformNodeId || ownerId);
  const [items, setItems] = useState<DataSandboxRecord[]>([]);
  const [images, setImages] = useState<DataSandboxRecord[]>([]);
  const [projects, setProjects] = useState<DataSandboxRecord[]>([]);
  const [createAssets, setCreateAssets] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [allowlistOpen, setAllowlistOpen] = useState(false);
  const [allowlistSandboxId, setAllowlistSandboxId] = useState('');
  const [allowlistItems, setAllowlistItems] = useState<DataSandboxRecord[]>([]);
  const [allowlistLoading, setAllowlistLoading] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [changeItem, setChangeItem] = useState<DataSandboxRecord>();
  const [changeType, setChangeType] = useState('');
  const [changeAssets, setChangeAssets] = useState<DataSandboxRecord[]>([]);
  const [mounts, setMounts] = useState<DataSandboxRecord[]>([]);
  const [mountsOpen, setMountsOpen] = useState(false);
  const [recyclingId, setRecyclingId] = useState('');
  const [form] = Form.useForm();
  const [imageForm] = Form.useForm();
  const [allowlistForm] = Form.useForm();
  const [changeForm] = Form.useForm();
  // 门禁直通角色：平台管理员（与后端 SandboxApprovalGate.isAdmin 一致）
  const isAdmin =
    loginService?.userInfo?.ownerId === 'kuscia-system' &&
    loginService?.userInfo?.name === 'admin';

  // Z-03 门禁：approval.required 开启且非 admin 时，创建/续期/回收须走申请单审批
  useEffect(() => {
    DataSandboxApi.approvalConfig()
      .then((res) => setApprovalRequired(Boolean(responseData(res, {})?.required)))
      .catch(() => setApprovalRequired(false));
  }, []);

  const gated = () => approvalRequired && !isAdmin;

  const guideToApproval = (text: string) => {
    Modal.confirm({
      title: '需走审批流程',
      content: `${text}需提交申请单审批，请在左侧「沙箱申请审批」菜单提交，审批通过后自动执行。`,
      okText: '知道了',
      cancelButtonProps: { style: { display: 'none' } },
    });
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sandboxResponse, imageResponse, projectResponse] = await Promise.all([
        DataSandboxApi.sandboxes({ ownerId }),
        DataSandboxApi.images(),
        API.P2PProjectController.listP2PProject(),
      ]);
      setItems(responseData(sandboxResponse, []));
      setImages(responseData(imageResponse, []));
      setProjects(responseData(projectResponse, []));
    } catch (requestError: unknown) {
      const detail = formatError(requestError, '加载沙箱失败');
      setError(detail);
      message.error(detail);
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

  // Z-02 网络白名单：仅 ALLOW_LIST 策略沙箱提供管理入口
  const loadAllowlist = async (sandboxId: string) => {
    setAllowlistLoading(true);
    try {
      setAllowlistItems(
        responseData(await DataSandboxApi.networkAllowlist(sandboxId), []),
      );
    } catch (error: any) {
      message.error(error.message || '加载白名单失败');
    } finally {
      setAllowlistLoading(false);
    }
  };
  const openAllowlist = async (sandboxId: string) => {
    setAllowlistSandboxId(sandboxId);
    setAllowlistOpen(true);
    allowlistForm.resetFields();
    loadAllowlist(sandboxId);
  };
  const addAllowlist = async (values: DataSandboxRecord) => {
    try {
      responseData(
        await DataSandboxApi.addNetworkAllowlist({
          sandboxId: allowlistSandboxId,
          ...values,
        }),
        {},
      );
      message.success('白名单已添加');
      allowlistForm.resetFields();
      loadAllowlist(allowlistSandboxId);
    } catch (error: any) {
      message.error(error.message || '添加白名单失败');
    }
  };
  const deleteAllowlist = async (id: string) => {
    try {
      responseData(await DataSandboxApi.deleteNetworkAllowlist(id), {});
      message.success('白名单已删除');
      loadAllowlist(allowlistSandboxId);
    } catch (error: any) {
      message.error(error.message || '删除白名单失败');
    }
  };

  const openChange = async (record: DataSandboxRecord, type: string) => {
    setChangeItem(record);
    setChangeType(type);
    changeForm.resetFields();
    if (type === 'SPEC_CHANGE')
      changeForm.setFieldsValue({
        cpuCores: record.cpu_cores,
        memoryGb: record.memory_gb,
        gpuCount: record.gpu_count,
        storageGb: record.storage_gb,
      });
    if (type === 'CONFIG_CHANGE')
      changeForm.setFieldsValue({
        imageId: record.image_id,
        networkPolicy: record.network_policy,
      });
    if (type === 'DATA_CHANGE') {
      const [projectData, currentMounts] = await Promise.all([
        DataAssetApi.projectAssets(record.project_id),
        DataAssetApi.sandboxMounts(record.id),
      ]);
      setChangeAssets(
        responseData(projectData, []).filter(
          (asset: DataSandboxRecord) => asset.data_stage === 'PROCESSED',
        ),
      );
      changeForm.setFieldsValue({
        datasetAssetIds: responseData(currentMounts, []).map(
          (mount: DataSandboxRecord) => mount.asset_id,
        ),
      });
    }
  };

  const submitChange = async (values: DataSandboxRecord) => {
    if (!changeItem) return;
    try {
      responseData(
        await DataSandboxApi.approvalSubmit({
          approvalType: changeType,
          sandboxId: changeItem.id,
          ...values,
        }),
        {},
      );
      message.success('变更申请已提交');
      setChangeItem(undefined);
    } catch (error: any) {
      message.error(error.message || '提交变更申请失败');
    }
  };

  const submitRecycle = async (record: DataSandboxRecord) => {
    setRecyclingId(record.id);
    try {
      responseData(
        await DataSandboxApi.approvalSubmit({
          approvalType: 'RECYCLE',
          sandboxId: record.id,
        }),
        {},
      );
      message.success('销毁申请已提交，请到“沙箱资源审核”查看审批进度');
      await refresh();
    } catch (error: unknown) {
      message.error(formatError(error, '销毁申请提交失败'));
    } finally {
      setRecyclingId('');
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
      title: '分配状态',
      dataIndex: 'alloc_state',
      render: (value: string) => {
        if (!value) return '-';
        const allocColors: Record<string, string> = {
          RESERVED: 'blue',
          BOUND: 'green',
          RELEASED: 'default',
        };
        return <Tag color={allocColors[value] || 'default'}>{value}</Tag>;
      },
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
          {(() => {
            const creator = record.created_by === loginService?.userInfo?.name;
            return (
              <>
                {record.status !== 'RUNNING' ? (
                  <Button
                    disabled={!creator}
                    size="small"
                    type="link"
                    onClick={() => action(record.id, 'START')}
                  >
                    启动
                  </Button>
                ) : (
                  <Button
                    disabled={!creator}
                    size="small"
                    type="link"
                    onClick={() => action(record.id, 'STOP')}
                  >
                    停止
                  </Button>
                )}
                {record.status === 'RUNNING' &&
                record.endpoint &&
                record.network_policy !== 'NO_NETWORK' ? (
                  <Button
                    size="small"
                    type="link"
                    disabled={!creator}
                    onClick={() => openDevEndpoint(record)}
                    style={{ color: '#1890ff' }}
                  >
                    打开开发环境
                  </Button>
                ) : null}
                {record.network_policy === 'ALLOW_LIST' ? (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => openAllowlist(record.id)}
                  >
                    白名单
                  </Button>
                ) : null}
                <Button
                  size="small"
                  type="link"
                  disabled={!creator}
                  onClick={async () => {
                    responseData(
                      await DataSandboxApi.approvalSubmit({
                        approvalType: 'RENEW',
                        sandboxId: record.id,
                        days: 7,
                      }),
                      {},
                    );
                    message.success('续期申请已提交');
                  }}
                >
                  续期7天
                </Button>
                <Button
                  disabled={!creator}
                  size="small"
                  type="link"
                  onClick={() => openChange(record, 'SPEC_CHANGE')}
                >
                  变更规格
                </Button>
                <Button
                  disabled={!creator}
                  size="small"
                  type="link"
                  onClick={() => openChange(record, 'DATA_CHANGE')}
                >
                  变更数据
                </Button>
                <Button
                  disabled={!creator}
                  size="small"
                  type="link"
                  onClick={() => openChange(record, 'CONFIG_CHANGE')}
                >
                  变更配置
                </Button>
                <Button
                  size="small"
                  type="link"
                  onClick={async () => {
                    setMounts(
                      responseData(await DataAssetApi.sandboxMounts(record.id), []),
                    );
                    setMountsOpen(true);
                  }}
                >
                  挂载数据
                </Button>
                <Button
                  size="small"
                  type="link"
                  disabled={!creator}
                  onClick={() => action(record.id, 'SNAPSHOT')}
                >
                  快照
                </Button>
                <Popconfirm
                  title="销毁后将回收全部配额，确定继续？"
                  okText="确定销毁"
                  cancelText="取消"
                  onConfirm={() => submitRecycle(record)}
                >
                  <Button
                    disabled={!creator || Boolean(recyclingId)}
                    loading={recyclingId === record.id}
                    danger
                    size="small"
                    type="link"
                  >
                    销毁
                  </Button>
                </Popconfirm>
              </>
            );
          })()}
        </Space>
      ),
    },
  ];

  return (
    <MvpPage
      title="沙箱资源申请"
      description="按项目申请沙箱，并统一提交延期、规格、配置、数据挂载与销毁申请"
      error={error}
      onRetry={refresh}
      extra={
        <>
          <RefreshButton loading={loading} onClick={refresh} />
          <Button onClick={() => setImageOpen(true)}>环境镜像</Button>
          <Button
            type="primary"
            onClick={() => {
              form.setFieldValue('ownerId', currentNodeId);
              setCreateOpen(true);
            }}
          >
            申请沙箱
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
            ownerId: currentNodeId,
            validDays: 7,
            networkPolicy: 'INTERNAL_ONLY',
            cpuCores: 2,
            memoryGb: 4,
            gpuCount: 0,
            storageGb: 20,
          }}
          onFinish={async (values) => {
            try {
              responseData(
                await DataSandboxApi.approvalSubmit({
                  ...values,
                  approvalType: 'CREATE',
                }),
                {},
              );
              message.success('沙箱申请已提交');
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
          <Form.Item
            name="description"
            label="沙箱描述"
            rules={[{ max: 500, message: '描述不能超过500个字符' }]}
          >
            <Input.TextArea
              rows={3}
              showCount
              maxLength={500}
              placeholder="说明沙箱用途、开发任务或使用范围"
            />
          </Form.Item>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              onChange={async (projectId) => {
                form.setFieldValue('datasetAssetIds', []);
                setCreateAssets(
                  responseData(await DataAssetApi.projectAssets(projectId), []).filter(
                    (asset: DataSandboxRecord) => asset.data_stage === 'PROCESSED',
                  ),
                );
              }}
              options={projects
                .filter((p) => checkAllApproved(p as API.ProjectVO))
                .map((p) => ({ value: p.projectId, label: p.projectName }))}
            />
          </Form.Item>
          <Form.Item name="datasetAssetIds" label="挂载数据">
            <Select
              mode="multiple"
              placeholder="仅可选择项目内有效的抽样脱敏数据"
              options={createAssets.map((a) => ({
                value: a.id,
                label: `${a.name}（${a.provider_node_id}）`,
              }))}
            />
          </Form.Item>
          <Form.Item name="ownerId" label="所属节点" rules={[{ required: true }]}>
            <Input disabled />
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
            <Form.Item name="gpuCount" label="GPU（运行时配额）">
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
        title={
          {
            SPEC_CHANGE: '申请规格变更',
            DATA_CHANGE: '申请挂载数据变更',
            CONFIG_CHANGE: '申请环境配置变更',
          }[changeType]
        }
        open={!!changeItem}
        onCancel={() => setChangeItem(undefined)}
        onOk={() => changeForm.submit()}
      >
        <Form form={changeForm} layout="vertical" onFinish={submitChange}>
          {changeType === 'SPEC_CHANGE' && (
            <Space wrap>
              <Form.Item name="cpuCores" label="CPU（核）">
                <InputNumber min={0.1} />
              </Form.Item>
              <Form.Item name="memoryGb" label="内存（GB）">
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="gpuCount" label="GPU">
                <InputNumber min={0} />
              </Form.Item>
              <Form.Item name="storageGb" label="存储（GB）">
                <InputNumber min={1} />
              </Form.Item>
            </Space>
          )}
          {changeType === 'DATA_CHANGE' && (
            <Form.Item name="datasetAssetIds" label="挂载数据">
              <Select
                mode="multiple"
                options={changeAssets.map((asset) => ({
                  value: asset.id,
                  label: `${asset.name}（${asset.provider_node_id}）`,
                }))}
              />
            </Form.Item>
          )}
          {changeType === 'CONFIG_CHANGE' && (
            <>
              <Form.Item name="imageId" label="环境镜像">
                <Select
                  options={images
                    .filter((image) => image.enabled)
                    .map((image) => ({ value: image.id, label: image.name }))}
                />
              </Form.Item>
              <Form.Item name="networkPolicy" label="网络策略">
                <Select
                  options={[
                    { value: 'INTERNAL_ONLY', label: '仅平台内网' },
                    { value: 'ALLOW_LIST', label: '出口白名单' },
                    { value: 'NO_NETWORK', label: '完全断网' },
                  ]}
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="reason" label="申请原因">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="沙箱挂载数据"
        open={mountsOpen}
        width={850}
        footer={null}
        onCancel={() => setMountsOpen(false)}
      >
        <Table
          rowKey="id"
          dataSource={mounts}
          columns={[
            { title: '数据', dataIndex: 'asset_name' },
            { title: '提供方', dataIndex: 'provider_node_id' },
            { title: '挂载路径', dataIndex: 'mount_path' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: string) => <Tag>{v}</Tag>,
            },
            { title: '有效期', dataIndex: 'expires_at', render: formatTime },
          ]}
        />
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

      <Modal
        title={`出口白名单（${allowlistSandboxId}）`}
        open={allowlistOpen}
        width={760}
        onCancel={() => setAllowlistOpen(false)}
        footer={null}
      >
        <Table
          rowKey="id"
          size="small"
          loading={allowlistLoading}
          pagination={false}
          dataSource={allowlistItems}
          columns={[
            { title: '目标地址', dataIndex: 'host' },
            { title: '端口', dataIndex: 'port' },
            {
              title: '协议',
              dataIndex: 'proto',
              render: (v: string) => <Tag>{v || 'tcp'}</Tag>,
            },
            { title: '备注', dataIndex: 'remark', render: (v: string) => v || '-' },
            { title: '创建时间', dataIndex: 'created_at', render: formatTime },
            {
              title: '操作',
              render: (_: unknown, row: DataSandboxRecord) => (
                <Button
                  danger
                  size="small"
                  type="link"
                  onClick={() => deleteAllowlist(row.id)}
                >
                  删除
                </Button>
              ),
            },
          ]}
        />
        <Form
          form={allowlistForm}
          layout="inline"
          style={{ marginTop: 20 }}
          initialValues={{ proto: 'tcp' }}
          onFinish={addAllowlist}
        >
          <Form.Item
            name="host"
            rules={[{ required: true, message: '请输入目标地址' }]}
          >
            <Input placeholder="目标地址，如 api.example.com" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="port" rules={[{ required: true, message: '端口 1-65535' }]}>
            <InputNumber min={1} max={65535} placeholder="端口" />
          </Form.Item>
          <Form.Item name="proto">
            <Select
              style={{ width: 90 }}
              options={[
                { value: 'tcp', label: 'tcp' },
                { value: 'udp', label: 'udp' },
              ]}
            />
          </Form.Item>
          <Form.Item name="remark">
            <Input placeholder="备注（可选）" style={{ width: 180 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            添加
          </Button>
        </Form>
      </Modal>
    </MvpPage>
  );
};
