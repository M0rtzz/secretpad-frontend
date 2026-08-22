import { Form, message, Modal, Switch, Table, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { MvpPage, formatTime } from '@/modules/data-sandbox-mvp/common';
import { DataAssetApi, DataSandboxRecord, responseData } from '@/services/data-sandbox';

/** 本节点沙箱挂载数据控制：点击表格行设置能否使用。 */
export const UsageControlComponent = () => {
  const [rows, setRows] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<DataSandboxRecord>();
  const [form] = Form.useForm();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(responseData(await DataAssetApi.mountControls(), []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);

  return (
    <MvpPage title="数据控制" description="控制本节点沙箱已挂载数据能否参与计算">
      <Table
        rowKey={(row) => `${row.sandbox_id}:${row.asset_id}`}
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 20 }}
        onRow={(row) => ({
          onClick: () => {
            setEditing(row);
            form.setFieldsValue({ allowUse: !!row.allow_use });
          },
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: '数据', dataIndex: 'asset_name' },
          { title: '沙箱', dataIndex: 'sandbox_name' },
          { title: '提供方', dataIndex: 'provider_node_name', render: (v) => v || '-' },
          {
            title: '使用控制',
            dataIndex: 'allow_use',
            render: (value: number) =>
              value ? (
                <Tag color="success">允许使用</Tag>
              ) : (
                <Tag color="error">禁止使用</Tag>
              ),
          },
          { title: '更新时间', dataIndex: 'updated_at', render: formatTime },
        ]}
      />
      <Modal
        title={`数据控制：${editing?.asset_name || ''}`}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={() => form.submit()}
        okText="保存"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            if (!editing) return;
            try {
              responseData(
                await DataAssetApi.saveMountControl({
                  sandboxId: editing.sandbox_id,
                  assetId: editing.asset_id,
                  allowUse: values.allowUse,
                  version: editing.version || 0,
                }),
                {},
              );
              message.success('数据控制已生效');
              setEditing(undefined);
              refresh();
            } catch (error: any) {
              message.error(error.message || '保存失败');
            }
          }}
        >
          <Form.Item
            name="allowUse"
            label="是否允许在当前沙箱使用"
            valuePropName="checked"
          >
            <Switch checkedChildren="允许" unCheckedChildren="禁止" />
          </Form.Item>
        </Form>
      </Modal>
    </MvpPage>
  );
};

export default UsageControlComponent;
