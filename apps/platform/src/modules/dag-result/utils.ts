import dayjs from 'dayjs';

import { DataSourceType } from '@/modules/data-source-list/type';

export const formatTimestamp = (timestamp: string) => {
  if (!timestamp) return '';
  const min = new Date(timestamp).getTime() / 1000 / 60;
  const localNow = new Date().getTimezoneOffset();

  const localTime = min - localNow;
  return dayjs(new Date(localTime * 1000 * 60)).format('YYYY-MM-DD HH:mm:ss');
};

/** Format an instant in China Standard Time while preserving legacy zone-less values. */
export const formatBeijingTimestamp = (timestamp: string) => {
  if (!timestamp) return '';
  const value = timestamp.trim();
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part(
    'minute',
  )}:${part('second')}`;
};

export const getDownloadBtnTitle = (type: DataSourceType, path?: string) => {
  switch (type) {
    case DataSourceType.OSS:
      return `OSS 文件不支持直接下载，请到 OSS 对应 bucket 的预设路径下找到文件下载，地址：${path}`;
    case DataSourceType.ODPS:
      return `ODPS 文件不支持直接下载，请到 ODPS 对应项目下找到文件下载，地址：${path}`;
    case DataSourceType.MYSQL:
      return `MYSQL 文件不支持直接下载，请到 MYSQL 对应的数据库下找到文件下载，地址：${path}`;
    default:
      return '';
  }
};
