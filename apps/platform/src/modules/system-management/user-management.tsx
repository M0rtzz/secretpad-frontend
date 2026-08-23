import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
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
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatTime, MvpPage } from '@/modules/data-sandbox-mvp/common';
import {
  ManagedUser,
  ManagedUserStatus,
  SystemUserManagementApi,
} from '@/services/system-user-management';

import styles from './index.less';

const INITIAL_PASSWORD = 'HUSTnlp2026!';

const accountStatus = {
  ENABLED: { label: '正常', color: 'success' },
  DISABLED: { label: '停用', color: 'error' },
} as const;

type UserForm = Pick<ManagedUser, 'account' | 'displayName'>;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '操作失败，请稍后重试';

export const UserManagementComponent = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<ManagedUser>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<UserForm>();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers((await SystemUserManagementApi.list()) || []);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return users.filter((user) => {
      const matchesKeyword =
        !normalized ||
        user.account.toLowerCase().includes(normalized) ||
        user.displayName.toLowerCase().includes(normalized);
      return matchesKeyword && (!statusFilter || user.status === statusFilter);
    });
  }, [keyword, statusFilter, users]);

  const openCreate = () => {
    setEditing(undefined);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditing(user);
    form.setFieldsValue({
      account: user.account,
      displayName: user.displayName,
    });
    setModalOpen(true);
  };

  const saveUser = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        account: values.account.trim().toLowerCase(),
        displayName: values.displayName.trim(),
      };
      if (editing) {
        await SystemUserManagementApi.update(payload);
        message.success('用户信息已更新');
      } else {
        await SystemUserManagementApi.create(payload);
        message.success(`用户已创建，初始密码为 ${INITIAL_PASSWORD}`);
      }
      setModalOpen(false);
      await loadUsers();
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (user: ManagedUser) => {
    const status: ManagedUserStatus =
      user.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    try {
      await SystemUserManagementApi.changeStatus(user.account, status);
      message.success(status === 'ENABLED' ? '用户已启用' : '用户已停用');
      await loadUsers();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const resetPassword = async (user: ManagedUser) => {
    try {
      await SystemUserManagementApi.resetPassword(user.account);
      message.success(`密码已重置为 ${INITIAL_PASSWORD}`);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const deleteUser = async (user: ManagedUser) => {
    try {
      await SystemUserManagementApi.delete(user.account);
      message.success('用户已删除，该账户名可重新创建');
      await loadUsers();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  return (
    <MvpPage
      title="用户管理"
      description="管理可真实登录数据沙箱的用户账号；新建和重置密码均使用统一初始密码"
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadUsers()}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增用户
          </Button>
        </Space>
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
        rowKey="account"
        loading={loading}
        dataSource={filteredUsers}
        pagination={{
          pageSize: 10,
          showTotal: (total) => '共 ' + total + ' 条',
        }}
        scroll={{ x: 900 }}
        columns={[
          {
            title: '账户',
            dataIndex: 'account',
            render: (value: string, row: ManagedUser) => (
              <>
                <span className={styles.cellTitle}>{value}</span>
                <span className={styles.cellDescription}>{row.displayName}</span>
              </>
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (value: ManagedUserStatus) => (
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
            fixed: 'right' as const,
            width: 310,
            render: (_: unknown, row: ManagedUser) => (
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
                  title={`确定将密码重置为 ${INITIAL_PASSWORD}？`}
                  onConfirm={() => resetPassword(row)}
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
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveUser()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="account"
            label="账户名"
            extra={
              editing
                ? undefined
                : `创建后可使用该账户和初始密码 ${INITIAL_PASSWORD} 登录`
            }
            rules={[
              { required: true, message: '请输入账户名' },
              {
                pattern: /^[a-z][a-z0-9._-]{2,15}$/,
                message:
                  '须以字母开头，由 3-16 位小写字母、数字、点、下划线或短横线组成',
              },
            ]}
          >
            <Input disabled={!!editing} maxLength={16} placeholder="请输入登录账户名" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="用户名称"
            rules={[
              { required: true, whitespace: true, message: '请输入用户名称' },
              { max: 64, message: '用户名称不能超过 64 个字符' },
            ]}
          >
            <Input maxLength={64} placeholder="请输入用户显示名称" />
          </Form.Item>
        </Form>
      </Modal>
    </MvpPage>
  );
};
