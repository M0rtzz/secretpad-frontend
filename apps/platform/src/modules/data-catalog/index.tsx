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
  Upload,
  Segmented,
  Tabs,
} from 'antd';
import { UploadOutlined, DatabaseOutlined, ApiOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';

import { MvpPage, RefreshButton, formatTime } from '@/modules/data-sandbox-mvp/common';
import { DataAssetApi, DataSandboxRecord, responseData } from '@/services/data-sandbox';
import { DataSourceListComponent } from '@/modules/data-source-list';

import { DataAssetPreviewTable } from './preview-table';

export const DataCatalogComponent = () => {
  const [items, setItems] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [preview, setPreview] = useState<DataSandboxRecord>();
  const [projectAsset, setProjectAsset] = useState<DataSandboxRecord>();
  const [view, setView] = useState<'assets' | 'sources'>('assets');
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState('file');
  const [apiForm] = Form.useForm();
  const [databaseForm] = Form.useForm();
  const [databasePreview, setDatabasePreview] = useState<DataSandboxRecord>();
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const databaseType = Form.useWatch('databaseType', databaseForm);
  const queryMode = Form.useWatch('queryMode', databaseForm);
  const [fileName, setFileName] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(responseData(await DataAssetApi.catalog({ keyword }), []));
    } catch (error: any) {
      message.error(error.message || '数据目录加载失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => void refresh(), [refresh]);

  const uploadFile = async ({ file, onSuccess, onError }: any) => {
    const body = new FormData();
    body.append('file', file);
    setFileName(file.name || '');
    try {
      const response = await fetch('/api/v1alpha1/data-assets/files/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'User-Token': localStorage.getItem('User-Token') || '' },
        body,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onSuccess(await response.json());
      message.success('数据上传成功');
      refresh();
    } catch (error) {
      onError(error);
      message.error('上传失败');
    }
  };

  const submitApi = async (values: DataSandboxRecord) => {
    setAddLoading(true);
    try {
      const headers = values.headers ? JSON.parse(values.headers) : {};
      responseData(await DataAssetApi.createApiSnapshot({ ...values, headers }), {});
      message.success('API 快照已添加');
      setAddOpen(false);
      apiForm.resetFields();
      refresh();
    } catch (error: any) {
      message.error(error.message || 'API 快照添加失败');
    } finally {
      setAddLoading(false);
    }
  };

  const databaseRequest = (values: DataSandboxRecord) => ({
    ...values,
    tableName: values.queryMode === 'table' ? values.tableName : '',
    sql: values.queryMode === 'sql' ? values.sql : '',
  });

  const previewDatabase = async () => {
    try {
      const values = await databaseForm.validateFields();
      setDatabaseLoading(true);
      setDatabasePreview(
        responseData(await DataAssetApi.previewDatabase(databaseRequest(values)), {}),
      );
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '数据库预览失败');
    } finally {
      setDatabaseLoading(false);
    }
  };

  const importDatabase = async () => {
    try {
      const values = await databaseForm.validateFields();
      setDatabaseLoading(true);
      await DataAssetApi.importDatabase(databaseRequest(values));
      message.success('库表数据已落盘并注册为本地数据资产');
      setAddOpen(false);
      setDatabasePreview(undefined);
      databaseForm.resetFields();
      refresh();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '数据库导入失败');
    } finally {
      setDatabaseLoading(false);
    }
  };

  return (
    <MvpPage
      title="数据目录"
      description="本节点源数据、抽样脱敏数据及项目共享数据的统一目录"
      extra={
        <Space>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setAddOpen(true)}
          >
            添加数据
          </Button>
          <Button icon={<DatabaseOutlined />} onClick={() => setView('sources')}>
            新建数据源
          </Button>
          <RefreshButton loading={loading} onClick={refresh} />
        </Space>
      }
    >
      <Space
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
      >
        <Segmented
          value={view}
          onChange={(value) => setView(value as 'assets' | 'sources')}
          options={[
            { label: '数据资产', value: 'assets' },
            { label: '数据源管理', value: 'sources' },
          ]}
        />
        {view === 'assets' && (
          <Input.Search
            allowClear
            placeholder="搜索数据名称或 ID"
            style={{ width: 300 }}
            onSearch={setKeyword}
          />
        )}
      </Space>
      {view === 'sources' ? (
        <DataSourceListComponent />
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          scroll={{ x: 1800 }}
          columns={[
            { title: '数据名称', dataIndex: 'name', fixed: 'left', width: 180 },
            {
              title: '元数据信息',
              dataIndex: 'metadata_json',
              width: 220,
              render: (v: string) => (
                <Tooltip title={<pre>{v}</pre>}>
                  <span>{v || '-'}</span>
                </Tooltip>
              ),
            },
            {
              title: '数据提供方',
              dataIndex: 'provider_node_name',
              width: 150,
              render: (v: string, row: DataSandboxRecord) => v || row.provider_node_id,
            },
            {
              title: '上传时间',
              dataIndex: 'created_at',
              width: 180,
              render: formatTime,
            },
            {
              title: '有效期',
              dataIndex: 'valid_until',
              width: 180,
              render: (v: string) => (v ? formatTime(v) : '长期有效'),
            },
            {
              title: '数据类型',
              dataIndex: 'data_stage',
              width: 150,
              render: (v: string) => (
                <Tag color={v === 'RAW' ? 'orange' : 'green'}>
                  {v === 'RAW' ? '源数据' : '抽样脱敏后数据'}
                </Tag>
              ),
            },
            {
              title: '抽样方法',
              dataIndex: 'sampling_method',
              width: 130,
              render: (v: string) => v || '-',
            },
            {
              title: '脱敏方法',
              dataIndex: 'masking_json',
              width: 200,
              render: (v: string) => v || '-',
            },
            {
              title: '源表/源数据',
              dataIndex: 'source_asset_id',
              width: 160,
              render: (v: string, row: DataSandboxRecord) =>
                v || row.datatable_id || '-',
            },
            {
              title: '挂载项目',
              dataIndex: 'mounted_project_count',
              width: 120,
              render: (count: number, row: DataSandboxRecord) =>
                count ? (
                  <Button type="link" onClick={() => setProjectAsset(row)}>
                    查看（{count}）
                  </Button>
                ) : (
                  '未挂载'
                ),
            },
            {
              title: '数据归属',
              dataIndex: 'owned',
              width: 130,
              render: (owned: boolean) => (
                <Tag color={owned ? 'green' : 'default'}>
                  {owned ? '本地数据' : '外部共享'}
                </Tag>
              ),
            },
            {
              title: '使用控制',
              width: 210,
              render: (_: unknown, row: DataSandboxRecord) =>
                row.control_valid_until
                  ? `有效至 ${row.control_valid_until}，导出：${
                      row.allow_export ? '允许' : '禁止'
                    }`
                  : '未设置',
            },
            {
              title: '操作',
              fixed: 'right',
              width: 170,
              render: (_: unknown, row: DataSandboxRecord) => (
                <Space>
                  <Button
                    type="link"
                    onClick={async () =>
                      setPreview(
                        responseData(await DataAssetApi.preview(row.id, 10), {}),
                      )
                    }
                  >
                    预览前10行
                  </Button>
                  {row.owned && (
                    <Popconfirm
                      title="确定删除该数据？若已挂载到项目，将提交项目全节点审批。"
                      onConfirm={async () => {
                        try {
                          const result = responseData(
                            await DataAssetApi.deleteAsset(row.id),
                            {},
                          );
                          message.success(
                            result.status === 'PENDING_APPROVAL'
                              ? `已提交 ${result.projectCount} 个项目的数据删除申请，请到“项目资源审核”查看进度`
                              : '删除成功',
                          );
                          refresh();
                        } catch (error: any) {
                          message.error(error.message || '删除失败');
                        }
                      }}
                    >
                      <Button danger type="link">
                        删除
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}
      <Modal
        title="添加数据"
        open={addOpen}
        width={720}
        footer={null}
        onCancel={() => setAddOpen(false)}
      >
        <Tabs
          activeKey={addMode}
          onChange={setAddMode}
          items={[
            {
              key: 'file',
              label: '文件上传',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload.Dragger
                    accept=".csv,.png"
                    maxCount={1}
                    showUploadList
                    customRequest={uploadFile}
                  >
                    <p>
                      <UploadOutlined />
                    </p>
                    <p>点击或拖拽上传 CSV / PNG</p>
                    <p>CSV 最大 500MB，PNG 最大 20MB</p>
                  </Upload.Dragger>
                  {fileName && <span>已选择：{fileName}</span>}
                </Space>
              ),
            },
            {
              key: 'api',
              label: 'API 快照',
              children: (
                <Form
                  form={apiForm}
                  layout="vertical"
                  onFinish={submitApi}
                  initialValues={{ method: 'GET' }}
                >
                  <Form.Item name="name" label="数据名称" rules={[{ required: true }]}>
                    <Input placeholder="user_api_snapshot" />
                  </Form.Item>
                  <Form.Item
                    name="url"
                    label="API 地址"
                    rules={[{ required: true, type: 'url' }]}
                  >
                    <Input prefix={<ApiOutlined />} />
                  </Form.Item>
                  <Form.Item name="method" label="请求方法">
                    <Segmented options={['GET', 'POST']} />
                  </Form.Item>
                  <Form.Item name="headers" label="请求头（JSON，可选）">
                    <Input.TextArea
                      rows={4}
                      placeholder={'{"Authorization":"Bearer xxx"}'}
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={addLoading}>
                    获取并保存快照
                  </Button>
                </Form>
              ),
            },
            {
              key: 'table',
              label: '库表接入',
              children: (
                <Form
                  form={databaseForm}
                  layout="vertical"
                  initialValues={{
                    databaseType: 'MYSQL',
                    port: 3306,
                    queryMode: 'table',
                    protocol: 'MYSQL',
                  }}
                >
                  <Form.Item name="name" label="数据名称" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Space align="start" wrap>
                    <Form.Item
                      name="databaseType"
                      label="数据库类型"
                      rules={[{ required: true }]}
                    >
                      <Select
                        style={{ width: 160 }}
                        onChange={(value) =>
                          databaseForm.setFieldValue(
                            'port',
                            value === 'POSTGRESQL' ? 5432 : 3306,
                          )
                        }
                        options={[
                          { value: 'MYSQL', label: 'MySQL' },
                          { value: 'POSTGRESQL', label: 'PostgreSQL' },
                          { value: 'OCEANBASE', label: 'OceanBase' },
                          { value: 'POLARDB', label: 'PolarDB' },
                        ]}
                      />
                    </Form.Item>
                    {databaseType === 'POLARDB' && (
                      <Form.Item name="protocol" label="兼容协议">
                        <Select
                          style={{ width: 160 }}
                          options={[
                            { value: 'MYSQL', label: 'MySQL' },
                            { value: 'POSTGRESQL', label: 'PostgreSQL' },
                          ]}
                        />
                      </Form.Item>
                    )}
                  </Space>
                  <Space align="start" wrap>
                    <Form.Item name="host" label="主机" rules={[{ required: true }]}>
                      <Input style={{ width: 260 }} placeholder="127.0.0.1" />
                    </Form.Item>
                    <Form.Item name="port" label="端口" rules={[{ required: true }]}>
                      <InputNumber min={1} max={65535} style={{ width: 120 }} />
                    </Form.Item>
                  </Space>
                  <Space align="start" wrap>
                    <Form.Item
                      name="database"
                      label="数据库名称"
                      rules={[{ required: true }]}
                    >
                      <Input style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item
                      name="username"
                      label="只读账号"
                      rules={[{ required: true }]}
                    >
                      <Input style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item name="password" label="密码">
                      <Input.Password style={{ width: 180 }} />
                    </Form.Item>
                  </Space>
                  <Form.Item name="queryMode" label="读取方式">
                    <Segmented
                      options={[
                        { value: 'table', label: '全表读取' },
                        { value: 'sql', label: 'SQL 过滤' },
                      ]}
                    />
                  </Form.Item>
                  {queryMode === 'sql' ? (
                    <Form.Item name="sql" label="只读 SQL" rules={[{ required: true }]}>
                      <Input.TextArea
                        rows={5}
                        placeholder="SELECT * FROM schema.table_name WHERE status = 'ACTIVE'"
                      />
                    </Form.Item>
                  ) : (
                    <Form.Item
                      name="tableName"
                      label="表名"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="schema.table_name" />
                    </Form.Item>
                  )}
                  <Space>
                    <Button loading={databaseLoading} onClick={previewDatabase}>
                      测试并预览
                    </Button>
                    <Button
                      type="primary"
                      loading={databaseLoading}
                      disabled={!databasePreview}
                      onClick={importDatabase}
                    >
                      导入为数据资产
                    </Button>
                  </Space>
                  {databasePreview && (
                    <div style={{ marginTop: 16 }}>
                      <DataAssetPreviewTable preview={databasePreview} />
                    </div>
                  )}
                </Form>
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        title="数据预览"
        open={!!preview}
        width={950}
        footer={null}
        onCancel={() => setPreview(undefined)}
      >
        <DataAssetPreviewTable preview={preview} />
      </Modal>
      <Modal
        title={`挂载项目 - ${projectAsset?.name || ''}`}
        open={!!projectAsset}
        footer={null}
        onCancel={() => setProjectAsset(undefined)}
      >
        <Table
          rowKey="project_id"
          pagination={false}
          dataSource={projectAsset?.mounted_projects || []}
          columns={[
            { title: '项目名称', dataIndex: 'name' },
            { title: '项目 ID', dataIndex: 'project_id' },
          ]}
        />
      </Modal>
    </MvpPage>
  );
};
