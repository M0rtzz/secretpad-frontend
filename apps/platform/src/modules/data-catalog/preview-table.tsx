import { Alert, Empty, Table, Tag, Typography } from 'antd';

import { DataSandboxRecord } from '@/services/data-sandbox';

export const DataAssetPreviewTable = ({ preview }: { preview?: DataSandboxRecord }) => {
  const previewRows = preview?.rows;
  const previewColumns = preview?.columns;
  const rows: DataSandboxRecord[] = Array.isArray(previewRows) ? previewRows : [];
  const names: string[] = Array.isArray(previewColumns)
    ? previewColumns
    : Object.keys(rows[0] || {});

  return (
    <>
      {preview?.masked && (
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 12 }}
          message="源数据已自动脱敏，预览不会展示完整字段值"
        />
      )}
      {preview?.asset?.name && (
        <Typography.Text type="secondary">
          数据集：{preview.asset.name} 预览行数：{rows.length}
        </Typography.Text>
      )}
      {names.length ? (
        <Table
          style={{ marginTop: 12 }}
          size="small"
          bordered
          pagination={false}
          rowKey={(_, index) => String(index)}
          dataSource={rows}
          scroll={{ x: 'max-content', y: 480 }}
          columns={names.map((name) => ({
            title: name,
            dataIndex: name,
            key: name,
            width: 160,
            render: (value: unknown) =>
              value === null || value === undefined || value === '' ? (
                <Tag>空</Tag>
              ) : (
                String(value)
              ),
          }))}
        />
      ) : (
        <Empty description="该数据暂无可表格化预览内容" />
      )}
    </>
  );
};
