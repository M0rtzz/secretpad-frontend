import {
  Button,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { MvpPage, RefreshButton, formatTime } from '@/modules/data-sandbox-mvp/common';
import { DataAssetApi, DataSandboxRecord, responseData } from '@/services/data-sandbox';

import { DataAssetPreviewTable } from './preview-table';

export const DataCatalogComponent = () => {
  const [items, setItems] = useState<DataSandboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [preview, setPreview] = useState<DataSandboxRecord>();

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

  return (
    <MvpPage
      title="数据目录"
      description="本节点源数据、抽样脱敏数据及项目共享数据的统一目录"
      extra={<RefreshButton loading={loading} onClick={refresh} />}
    >
      <Input.Search
        allowClear
        placeholder="搜索数据名称或 ID"
        style={{ width: 300, marginBottom: 16 }}
        onSearch={setKeyword}
      />
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
            render: (v: string, row: DataSandboxRecord) => v || row.datatable_id || '-',
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
                    setPreview(responseData(await DataAssetApi.preview(row.id, 10), {}))
                  }
                >
                  预览前10行
                </Button>
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
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title="数据预览"
        open={!!preview}
        width={950}
        footer={null}
        onCancel={() => setPreview(undefined)}
      >
        <DataAssetPreviewTable preview={preview} />
      </Modal>
    </MvpPage>
  );
};
