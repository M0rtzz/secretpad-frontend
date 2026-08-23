import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { useMemo, useState } from 'react';

import { formatTime, MvpPage } from '@/modules/data-sandbox-mvp/common';

import styles from './index.less';
import { createEntityId, SandboxUser, useSystemManagementStore } from './store';

const accountStatus = {
  ENABLED: { label: '正常', color: 'success' },
  DISABLED: { label: '停用', color: 'error' },
} as const;

export const UserManagementComponent = () => {
  const { state, updateState } = useSystemManagementStore();
  const [keyword, setKeyword] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<SandboxUser>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<SandboxUser>();

  const tenantNames = useMemo(
    () => Object.fromEntries(state.tenants.map((tenant) => [tenant.id, tenant.name])),
    [state.tenants],
  );
  const roleNames = useMemo(
    () => Object.fromEntries(state.roles.map((role) => [role.id, role.name])),
    [state.roles],
  );
  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return state.users.filter((user) => {
      const matchesKeyword =
        !normalized ||
        user.account.toLowerCase().includes(normalized) ||
        user.displayName.toLowerCase().includes(normalized);
      return (
        matchesKeyword &&
        (!tenantFilter || user.tenantId === tenantFilter) &&
        (!statusFilter || user.status === statusFilter)
      );
    });
  }, [keyword, state.users, statusFilter, tenantFilter]);

  const openCreate = () => {
    setEditing(undefined);
    form.resetFields();
    form.setFieldsValue({
      status: 'ENABLED',
      roleIds: [],
      tenantId: state.tenants.find((item) => item.status === 'ACTIVE')?.id,
    } as SandboxUser);
    setModalOpen(true);
  };

  const openEdit = (user: SandboxUser) => {
    setEditing(user);
    form.setFieldsValue(user);
    setModalOpen(true);
  };

  const saveUser = async () => {
    const values = await form.validateFields();
    const account = values.account.trim();
    const duplicated = state.users.some(
      (user) =>
        user.id !== editing?.id && user.account.toLowerCase() === account.toLowerCase(),
    );
    if (duplicated) {
      message.error('账户名已存在');
      return;
    }
    updateState((current) => ({
      ...current,
      users: editing
        ? current.users.map((user) =>
            user.id === editing.id
              ? {
                  ...user,
                  ...values,
                  account,
                  displayName: values.displayName.trim(),
                }
              : user,
          )
        : [
            {
              ...values,
              id: createEntityId('user'),
              account,
              displayName: values.displayName.trim(),
              createdAt: new Date().toISOString(),
            },
            ...current.users,
          ],
    }));
    message.success(editing ? '用户信息已更新' : '用户已创建');
    setModalOpen(false);
  };

  const toggleUser = (user: SandboxUser) => {
    const status = user.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    updateState((current) => ({
      ...current,
      users: current.users.map((item) =>
        item.id === user.id ? { ...item, status } : item,
      ),
    }));
    message.success(status === 'ENABLED' ? '用户已启用' : '用户已停用');
  };

  const deleteUser = (user: SandboxUser) => {
    updateState((current) => ({
      ...current,
      users: current.users.filter((item) => item.id !== user.id),
    }));
    message.success('用户已删除');
  };

  return (
    <MvpPage
      title="用户管理"
      description="管理数据沙箱账号，并为用户分配所属租户和沙箱角色"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增用户
        </Button>
      }
    >
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input.Search
            allowClear
            placeholder="搜索账户名或用户名称"
            onSearch={setKeyword}
            style={{ width: 260 }}
          />
          <Select
            value={tenantFilter}
            onChange={setTenantFilter}
            style={{ width: 180 }}
            options={[
              { value: '', label: '全部租户' },
              ...state.tenants.map((tenant) => ({
                value: tenant.id,
                label: tenant.name,
              })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 130 }}
            options={[
              { value: '', label: '全部状态' },
              { value: 'ENABLED', label: '正常' },
              { value: 'DISABLED', label: '停用' },
            ]}
          />
        </div>
        <span>共 {filteredUsers.length} 个用户</span>
      </div>
      <Table
        rowKey="id"
        dataSource={filteredUsers}
        pagination={{
          pageSize: 10,
          showTotal: (total) => '共 ' + total + ' 条',
        }}
        scroll={{ x: 1050 }}
        columns={[
          {
            title: '账户',
            dataIndex: 'account',
            render: (value: string, row: SandboxUser) => (
              <>
                <span className={styles.cellTitle}>{value}</span>
                <span className={styles.cellDescription}>{row.displayName}</span>
              </>
            ),
          },
          {
            title: '所属租户',
            dataIndex: 'tenantId',
            render: (value: string) => tenantNames[value] || '-',
          },
          {
            title: '角色',
            dataIndex: 'roleIds',
            render: (values: string[]) => (
              <Space size={[0, 4]} wrap>
                {values.map((roleId) => (
                  <Tag color="blue" key={roleId}>
                    {roleNames[roleId] || roleId}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 90,
            render: (value: keyof typeof accountStatus) => (
              <Tag color={accountStatus[value].color}>{accountStatus[value].label}</Tag>
            ),
          },
          {
            title: '最近登录',
            dataIndex: 'lastLoginAt',
            width: 180,
            render: formatTime,
          },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            render: formatTime,
          },
          {
            title: '操作',
            key: 'actions',
            fixed: 'right',
            width: 270,
            render: (_: unknown, row: SandboxUser) => (
              <Space size={0}>
                <Button type="link" onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Popconfirm
                  title={
                    '确定' + (row.status === 'ENABLED' ? '停用' : '启用') + '该用户？'
                  }
                  onConfirm={() => toggleUser(row)}
                >
                  <Button type="link">
                    {row.status === 'ENABLED' ? '停用' : '启用'}
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="将该用户密码重置为系统初始密码？"
                  onConfirm={() => message.success('密码已重置')}
                >
                  <Button type="link">重置密码</Button>
                </Popconfirm>
                <Popconfirm
                  title="删除后用户将无法登录，确定继续？"
                  onConfirm={() => deleteUser(row)}
                >
                  <Button danger type="link">
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={modalOpen}
        title={editing ? '编辑用户' : '新增用户'}
        onCancel={() => setModalOpen(false)}
        onOk={saveUser}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="account"
            label="账户名"
            rules={[
              { required: true, message: '请输入账户名' },
              { min: 3, max: 50, message: '账户名长度为 3 到 50 个字符' },
            ]}
          >
            <Input disabled={!!editing} placeholder="请输入登录账户名" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="用户名称"
            rules={[{ required: true, message: '请输入用户名称' }]}
          >
            <Input maxLength={20} placeholder="请输入用户显示名称" />
          </Form.Item>
          <Form.Item
            name="tenantId"
            label="所属租户"
            rules={[{ required: true, message: '请选择所属租户' }]}
          >
            <Select
              placeholder="请选择所属租户"
              options={state.tenants
                .filter(
                  (tenant) =>
                    tenant.status === 'ACTIVE' || tenant.id === editing?.tenantId,
                )
                .map((tenant) => ({
                  value: tenant.id,
                  label: tenant.name,
                }))}
            />
          </Form.Item>
          <Form.Item
            name="roleIds"
            label="用户角色"
            rules={[{ required: true, message: '请至少选择一个角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择用户角色"
              options={state.roles.map((role) => ({
                value: role.id,
                label: role.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="status" label="账号状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ENABLED', label: '正常' },
                { value: 'DISABLED', label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </MvpPage>
  );
};
