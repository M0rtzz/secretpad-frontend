import {
  CloudServerOutlined,
  DatabaseOutlined,
  EditOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Empty, Form, Modal, Select, Table, Tag, message } from 'antd';
import { Button, Typography, Tooltip, Input, Space } from 'antd';
import { Spin } from 'antd';
import classNames from 'classnames';
import { parse } from 'query-string';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import React from 'react';
import { history, useLocation } from 'umi';

import { EdgeRouteWrapper, isP2PWorkbench } from '@/components/platform-wrapper';
import { P2PCreateProjectModal } from '@/modules/create-project/p2p-create-project/p2p-create-project.view';
import { ProjectType } from '@/modules/create-project/p2p-create-project/compute-func-data';
import { formatTimestamp } from '@/modules/dag-result/utils';
import { DataAssetPreviewTable } from '@/modules/data-catalog/preview-table';
import { EditProjectModal } from '@/modules/project-list/components/edit-project';
import { getModel, Model, useModel } from '@/util/valtio-helper';
import {
  DataAssetApi,
  DataSandboxApi,
  DataSandboxRecord,
  responseData,
} from '@/services/data-sandbox';

import { DefaultModalManager } from '../dag-modal-manager';
import {
  P2pProjectDetailDrawer,
  p2pProjectDetailDrawer,
} from '../p2p-project-detail/project-detail-drawer';
import { AuthProjectTag } from '../p2p-project-list/components/auth-project-tag';
import {
  SelectProjectState,
  checkAllApproved,
} from '../p2p-project-list/components/common';
import {
  ComputeModeType,
  P2pProjectButtons,
  ProjectComputeModeSelect,
  ProjectStateSelect,
  ProjectStatus,
  RadioGroup,
  RadioGroupState,
  computeModeText,
} from '../p2p-project-list/components/common';

import { ProjectTypeTag } from './components/project-type-tag';
import styles from './index.less';
import { P2pProjectListService } from './p2p-project-list.service';

export enum TabKey {
  'PARTIES' = 'parties',
  'PIPELINES' = 'pipelines',
  'TASKS' = 'tasks',
}

export const P2pProjectListComponent: React.FC = () => {
  const projectListModel = useModel(ProjectListModel);
  const p2pProjectService = useModel(P2pProjectListService);
  const modalManager = useModel(DefaultModalManager);
  const { pathname } = useLocation();

  const { handleCreateProject } = projectListModel;

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { displayProjectList: projectList } = p2pProjectService;

  const { Title, Paragraph } = Typography;

  const { ownerId } = parse(window.location.search);
  const [sandboxEnvironments, setSandboxEnvironments] = useState<DataSandboxRecord[]>(
    [],
  );

  useEffect(() => {
    p2pProjectService.getListProject();
    DataSandboxApi.sandboxes({}).then((response) =>
      setSandboxEnvironments(responseData(response, [])),
    );
  }, []);

  const [editProjectData, setEditProjectData] = useState({});

  const [hoverCurrent, setHoverCurrent] = useState(-1);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
  const [projectAssets, setProjectAssets] = useState<DataSandboxRecord[]>([]);
  const [preview, setPreview] = useState<DataSandboxRecord>();
  const [assetProjectId, setAssetProjectId] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachAssets, setAttachAssets] = useState<DataSandboxRecord[]>([]);
  const [attachForm] = Form.useForm();
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxProjectName, setSandboxProjectName] = useState('');
  const [projectSandboxes, setProjectSandboxes] = useState<DataSandboxRecord[]>([]);

  const openProjectAssets = async (projectId: string) => {
    setAssetProjectId(projectId);
    setAssetOpen(true);
    setAssetLoading(true);
    try {
      setProjectAssets(responseData(await DataAssetApi.projectAssets(projectId), []));
    } finally {
      setAssetLoading(false);
    }
  };

  const openProjectSandboxes = (projectId: string, projectName: string) => {
    setProjectSandboxes(
      sandboxEnvironments.filter(
        (sandbox) => sandbox.project_id === projectId && !sandbox.deleted,
      ),
    );
    setSandboxProjectName(projectName);
    setSandboxOpen(true);
  };

  const { Link } = Typography;

  const loadMore = isP2PWorkbench(pathname) && projectList.length > 6 && (
    <div className={styles.showAll}>
      <Link
        style={{ color: 'rgba(0,0,0,0.45)' }}
        onClick={() => {
          history.push(`/edge?ownerId=${ownerId}&tab=my-project`);
        }}
      >
        查看全部
      </Link>
    </div>
  );

  const [searchInput, setSearchInput] = useState('');
  const searchProject = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    projectListModel.searchProject(e.target.value);
  };

  useEffect(() => {
    setSearchInput('');
  }, [
    projectListModel.radioFilterState,
    projectListModel.computeMode,
    projectListModel.selectState,
  ]);

  const handleOpenProjectDetail = (item: API.ProjectVO, tabKey: string) => {
    return () => {
      modalManager.openModal(p2pProjectDetailDrawer.id, {
        ...item,
        tabKey,
      });
    };
  };

  return (
    <div
      className={classNames(styles.projectList, {
        [styles.p2pProjectList]: isP2PWorkbench(pathname),
      })}
    >
      <EdgeRouteWrapper>
        <div className={styles.projectListHeader}>
          {isP2PWorkbench(pathname) ? (
            <div className={styles.headerTitle}>我的项目</div>
          ) : (
            <Space size="middle" wrap>
              <Input
                placeholder="搜索项目"
                onChange={(e) => searchProject(e)}
                style={{ width: 200 }}
                value={searchInput}
                suffix={
                  <SearchOutlined
                    style={{
                      color: '#aaa',
                    }}
                  />
                }
              />
              <RadioGroup
                value={projectListModel.radioFilterState}
                onChange={projectListModel.changefilterState}
              />
              <ProjectComputeModeSelect
                onChange={projectListModel.onSelectProject}
                value={projectListModel.computeMode}
              />
              <ProjectStateSelect
                onChange={projectListModel.changeProjectState}
                value={projectListModel.selectState}
              />
            </Space>
          )}
          <Button type="primary" onClick={handleCreateProject}>
            新建项目
          </Button>
          <P2PCreateProjectModal
            visible={projectListModel.showCreateProjectModel}
            close={() => {
              projectListModel.showCreateProjectModel = false;
            }}
            onOk={() => p2pProjectService.getListProject()}
          />
        </div>
      </EdgeRouteWrapper>
      <Spin
        spinning={projectListModel.projectListService.projectListLoading}
        className={styles.spin}
      >
        <div></div>
      </Spin>
      {projectList.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div
          className={classNames(styles.content, {
            [styles.p2pContent]: isP2PWorkbench(pathname),
          })}
        >
          {(isP2PWorkbench(pathname) ? projectList.slice(0, 6) : projectList).map(
            (item, index) => {
              return (
                <div
                  className={styles.projectBox}
                  key={item.projectId}
                  onMouseEnter={() => {
                    setHoverCurrent(index);
                  }}
                  onMouseLeave={() => {
                    setHoverCurrent(-1);
                  }}
                >
                  <div>
                    <div className={styles.listBox}>
                      {item.status === ProjectStatus.ARCHIVED && (
                        <div className={styles.archiveTag}>
                          <span>已归档</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {(item.developmentModes || []).map((mode: string) => (
                          <Tag key={mode} color="blue">
                            {{
                              SQL: 'SQL',
                              PYTHON: 'Python',
                              FUNCTION_ECOSYSTEM: '函数与生态库管理',
                              JAR: 'JAR 计算',
                            }[mode] || mode}
                          </Tag>
                        ))}
                        <div style={{ marginRight: 8 }}>
                          <ProjectTypeTag
                            type={(item.computeFunc || 'DAG') as ProjectType}
                          />
                        </div>
                        <div className={styles.header} style={{ flex: 1 }}>
                          <Tooltip title={item.projectName}>
                            <Title
                              className={styles.ellipsisName}
                              level={5}
                              ellipsis={true}
                            >
                              {item.projectName}
                            </Title>
                          </Tooltip>
                          {/* 只有项目发起方才可编辑，并且项目不是已归档项目 */}
                          {item.status !== ProjectStatus.ARCHIVED &&
                            item.initiator === ownerId && (
                              <EditOutlined
                                className={styles.editButton}
                                onClick={() => {
                                  setIsModalOpen(true);
                                  setEditProjectData(item);
                                }}
                              />
                            )}
                        </div>
                      </div>
                      <Paragraph ellipsis={{ rows: 1 }} className={styles.ellipsisDesc}>
                        {item.description || '暂无描述'}
                      </Paragraph>
                      {/* 有受邀方没有通过 */}
                      {!checkAllApproved(item) && (
                        <div className={styles.authProjectTagContent}>
                          <AuthProjectTag
                            currentInst={{ id: ownerId as string }}
                            simple={hoverCurrent !== index}
                            project={item}
                          />
                        </div>
                      )}
                      {/* 所有的受邀方都通过展示 */}
                      {checkAllApproved(item) && (
                        <div className={styles.projects}>
                          <div className={styles.task}>
                            <div className={styles.titleName}>参与机构</div>
                            <div
                              className={styles.count}
                              onClick={handleOpenProjectDetail(item, TabKey.PARTIES)}
                            >
                              {[
                                {
                                  instId: item.initiator,
                                  nodeName: item.initiatorName,
                                },
                                ...(item.partyVoteInfos || []),
                              ].length || 0}
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              flex: 1,
                            }}
                          >
                            <div className={styles.titleName}>沙箱数</div>
                            <span
                              className={styles.count}
                              onClick={() =>
                                openProjectSandboxes(
                                  item.projectId as string,
                                  item.projectName as string,
                                )
                              }
                            >
                              {
                                sandboxEnvironments.filter(
                                  (sandbox) =>
                                    sandbox.project_id === item.projectId &&
                                    !sandbox.deleted,
                                ).length
                              }
                            </span>
                          </div>
                          <div className={styles.task}>
                            <div className={styles.titleName}>任务数</div>
                            <div
                              className={styles.count}
                              onClick={handleOpenProjectDetail(item, TabKey.TASKS)}
                            >
                              {item.jobCount}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className={styles.time}>
                        创建人：{item.initiatorName || item.initiator || '-'} · 创建于
                        {formatTimestamp(item.gmtCreate as string)}
                      </div>
                      <div className={styles.time}>
                        环境状态：
                        {(() => {
                          const related = sandboxEnvironments.filter(
                            (sandbox) =>
                              sandbox.project_id === item.projectId && !sandbox.deleted,
                          );
                          if (!related.length) return '未申请';
                          if (related.some((sandbox) => sandbox.status === 'RUNNING'))
                            return '运行中';
                          if (
                            related.some((sandbox) =>
                              ['APPROVED', 'STARTING'].includes(sandbox.status),
                            )
                          )
                            return '申请/启动中';
                          return related.map((sandbox) => sandbox.status).join('、');
                        })()}
                      </div>
                    </div>
                    <div className={styles.bootom}>
                      <Button
                        type="link"
                        icon={<DatabaseOutlined />}
                        onClick={() => openProjectAssets(item.projectId as string)}
                      >
                        数据目录
                      </Button>
                      <Button
                        type="link"
                        icon={<CloudServerOutlined />}
                        onClick={() =>
                          openProjectSandboxes(
                            item.projectId as string,
                            item.projectName as string,
                          )
                        }
                      >
                        沙箱目录
                      </Button>
                      <P2pProjectButtons project={item} />
                    </div>
                  </div>
                </div>
              );
            },
          )}
          {!isP2PWorkbench(pathname) && (
            <>
              <i></i>
              <i></i>
              <i></i>
            </>
          )}
        </div>
      )}
      {loadMore}
      <EditProjectModal
        isModalOpen={isModalOpen}
        handleCancel={() => setIsModalOpen(false)}
        data={editProjectData}
        onEdit={p2pProjectService.projectEdit}
      />
      <P2pProjectDetailDrawer />
      <Modal
        title="项目挂载数据目录"
        open={assetOpen}
        width={1050}
        footer={
          <Button
            type="primary"
            onClick={async () => {
              setAttachAssets(
                responseData(await DataAssetApi.catalog({}), []).filter(
                  (asset: DataSandboxRecord) => asset.owned !== false,
                ),
              );
              setAttachOpen(true);
            }}
          >
            挂载本节点数据
          </Button>
        }
        onCancel={() => setAssetOpen(false)}
      >
        <Table
          rowKey="id"
          loading={assetLoading}
          dataSource={projectAssets}
          scroll={{ x: 900 }}
          columns={[
            { title: '数据集名称', dataIndex: 'name' },
            {
              title: '数据提供方',
              dataIndex: 'provider_node_name',
              render: (v: string, row: DataSandboxRecord) => v || row.provider_node_id,
            },
            {
              title: '数据类型',
              dataIndex: 'data_stage',
              render: (v: string) => (
                <Tag color={v === 'RAW' ? 'orange' : 'green'}>
                  {v === 'RAW' ? '源数据' : '抽样脱敏后数据'}
                </Tag>
              ),
            },
            {
              title: '挂载时间',
              dataIndex: 'attached_at',
              render: (v: string) => formatTimestamp(v),
            },
            {
              title: '有效期',
              dataIndex: 'valid_until',
              render: (v: string) => (v ? formatTimestamp(v) : '长期有效'),
            },
            {
              title: '操作',
              render: (_: unknown, row: DataSandboxRecord) => (
                <Button
                  type="link"
                  onClick={async () => {
                    if (row.owned === false) {
                      setPreview({
                        asset: row,
                        columns: row.schema_columns || [],
                        rows: [],
                        sharedMetadataOnly: true,
                      });
                      return;
                    }
                    setPreview(responseData(await DataAssetApi.preview(row.id, 5), {}));
                  }}
                >
                  格式预览
                </Button>
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        title={`项目沙箱目录${sandboxProjectName ? ` · ${sandboxProjectName}` : ''}`}
        open={sandboxOpen}
        width={1200}
        footer={null}
        onCancel={() => setSandboxOpen(false)}
      >
        <Table
          rowKey="id"
          dataSource={projectSandboxes}
          scroll={{ x: 1200 }}
          columns={[
            { title: '沙箱名称', dataIndex: 'name', fixed: 'left', width: 180 },
            {
              title: '创建节点',
              dataIndex: 'owner_node_name',
              width: 150,
              render: (value: string, row: DataSandboxRecord) =>
                value || row.owner_id || '-',
            },
            {
              title: '创建人',
              dataIndex: 'created_by',
              width: 120,
              render: (value: string) => value || '-',
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              width: 180,
              render: (value: string) => (value ? formatTimestamp(value) : '-'),
            },
            {
              title: '描述',
              dataIndex: 'description',
              width: 220,
              ellipsis: true,
              render: (value: string) => value || '暂无描述',
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (value: string) => <Tag>{value || '-'}</Tag>,
            },
            {
              title: '环境镜像',
              dataIndex: 'image_name',
              width: 150,
              render: (value: string) => value || '-',
            },
            {
              title: '资源规格',
              width: 230,
              render: (_: unknown, row: DataSandboxRecord) =>
                `${row.cpu_cores || 0}C / ${row.memory_gb || 0}GB / GPU ${
                  row.gpu_count || 0
                } / ${row.storage_gb || 0}GB`,
            },
            {
              title: '网络策略',
              dataIndex: 'network_policy',
              width: 140,
              render: (value: string) => value || '-',
            },
            {
              title: '到期时间',
              dataIndex: 'expires_at',
              width: 180,
              render: (value: string) => (value ? formatTimestamp(value) : '-'),
            },
          ]}
        />
      </Modal>
      <Modal
        title="数据格式及样例预览"
        open={!!preview}
        width={850}
        footer={null}
        onCancel={() => setPreview(undefined)}
      >
        <DataAssetPreviewTable preview={preview} />
      </Modal>
      <Modal
        title="挂载本节点数据到项目"
        open={attachOpen}
        onCancel={() => setAttachOpen(false)}
        onOk={() => attachForm.submit()}
      >
        <Form
          form={attachForm}
          layout="vertical"
          onFinish={async ({ assetIds }) => {
            try {
              setProjectAssets(
                responseData(
                  await DataAssetApi.attachProjectAssets({
                    projectId: assetProjectId,
                    assetIds,
                  }),
                  [],
                ),
              );
              message.success('数据已挂载到项目');
              setAttachOpen(false);
              attachForm.resetFields();
            } catch (error: any) {
              message.error(error.message || '挂载失败');
            }
          }}
        >
          <Form.Item name="assetIds" label="数据" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={attachAssets.map((asset) => ({
                value: asset.id,
                label: `${asset.name}（${
                  asset.data_stage === 'RAW' ? '源数据' : '抽样脱敏数据'
                }）`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export class ProjectListModel extends Model {
  readonly projectListService;

  constructor() {
    super();
    this.projectListService = getModel(P2pProjectListService);
  }

  instId: string | undefined = undefined;

  onViewMount() {
    const { ownerId } = parse(window.location.search);
    if (ownerId) {
      this.instId = ownerId as string;
    }
    this.resetFilters();
  }

  pipelines: API.GraphMetaVO[] = [];

  showCreateProjectModel = false;

  radioFilterState = RadioGroupState.ALL;
  selectState = SelectProjectState.ALL;
  computeMode = ComputeModeType.ALL;

  changefilterState = (value: RadioGroupState) => {
    this.resetFilters();
    this.radioFilterState = value;
    this.projectListService.displayProjectList =
      this.projectListService.projectList.filter((i) => {
        if (value === RadioGroupState.ALL) {
          return i;
        } else if (value === RadioGroupState.APPLY) {
          return i.initiator && i.initiator === this.instId;
        } else if (value === RadioGroupState.PROCESS) {
          return (
            i.partyVoteInfos &&
            (i.partyVoteInfos || []).some((item) => item.partyId === this.instId)
          );
        }
      });
  };

  changeProjectState = (value: SelectProjectState) => {
    this.resetFilters();
    this.selectState = value;
    this.projectListService.displayProjectList =
      this.projectListService.projectList.filter((i) => {
        if (!i.status) return;
        if (value === SelectProjectState.ALL) {
          return i;
        } else if (value === SelectProjectState.ARCHIVED) {
          return i.status && i.status === SelectProjectState.ARCHIVED;
        } else if (value === SelectProjectState.REVIEWING) {
          return i.status && i.status === SelectProjectState.REVIEWING;
        }
      });
  };

  searchProject = (value: string) => {
    this.projectListService.displayProjectList =
      this.projectListService.projectList.filter((i) => {
        if (!i.projectName) return;
        return i.projectName?.indexOf(value) >= 0;
      });
  };

  onSelectProject = (e: string) => {
    this.resetFilters();
    this.computeMode = e as ComputeModeType;
    this.projectListService.displayProjectList =
      this.projectListService.projectList.filter((i) => {
        if (e === ComputeModeType.ALL) {
          return i;
        } else if (e === ComputeModeType.TEE) {
          return i.computeMode && i.computeMode.indexOf(ComputeModeType.TEE) >= 0;
        } else if (e === ComputeModeType.MPC) {
          // 兼容除tee外的
          return i.computeMode && !(i.computeMode.indexOf(ComputeModeType.TEE) >= 0);
        }
      });
  };

  resetFilters = () => {
    this.computeMode = ComputeModeType.ALL;
    this.radioFilterState = RadioGroupState.ALL;
    this.selectState = SelectProjectState.ALL;
  };

  handleCreateProject = () => {
    this.showCreateProjectModel = true;
  };
}
