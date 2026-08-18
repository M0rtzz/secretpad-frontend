import Icon from '@ant-design/icons';
import {
  ApiOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { parse } from 'query-string';
import { lazy, useEffect } from 'react';
import { useLocation } from 'umi';

import { ReactComponent as DataSource } from '@/assets/data-source.svg';
import { ReactComponent as DataManager } from '@/assets/jiaochabiao.svg';
import { ReactComponent as CooperativeNode } from '@/assets/join-node.svg';
import { ReactComponent as projectManager } from '@/assets/project-manager.svg';
import { ReactComponent as ResultManager } from '@/assets/resultmanager.svg';
import { ReactComponent as Workbench } from '@/assets/workbench.svg';
import { CooperativeNodeListComponent } from '@/modules/cooperative-node-list';
import { DataManagerComponent } from '@/modules/data-manager/data-manager.view';
import { DataSourceListComponent } from '@/modules/data-source-list';
import { HomeLayout } from '@/modules/layout/home-layout';
import { HomeLayoutService } from '@/modules/layout/home-layout/home-layout.service';
import { ManagementLayoutComponent } from '@/modules/layout/management-layout';
import { MessageService } from '@/modules/message-center/message.service';
import { NodeService } from '@/modules/node';
import { P2pProjectListComponent } from '@/modules/p2p-project-list';
import { P2PWorkbenchComponent } from '@/modules/p2p-workbench/workbench.view';
import { ResultManagerComponent } from '@/modules/result-manager/result-manager.view';
import { useModel } from '@/util/valtio-helper';
import { hasAccess, Platform } from '@/components/platform-wrapper';

// Keep the workbench bundle small and isolate optional MVP pages. A failure in
// one management page must not prevent the default workbench from mounting.
const SandboxManagerComponent = lazy(() =>
  import('@/modules/sandbox-manager').then(
    ({ SandboxManagerComponent: Component }) => ({
      default: Component,
    }),
  ),
);
const ResourceManagerComponent = lazy(() =>
  import('@/modules/resource-manager').then(
    ({ ResourceManagerComponent: Component }) => ({
      default: Component,
    }),
  ),
);
const ModelApprovalComponent = lazy(() =>
  import('@/modules/model-approval').then(({ ModelApprovalComponent: Component }) => ({
    default: Component,
  })),
);
const UnifiedLogComponent = lazy(() =>
  import('@/modules/unified-log').then(({ UnifiedLogComponent: Component }) => ({
    default: Component,
  })),
);
const IntegrationManagerComponent = lazy(() =>
  import('@/modules/integration-manager').then(
    ({ IntegrationManagerComponent: Component }) => ({
      default: Component,
    }),
  ),
);
const OperationCenterComponent = lazy(() =>
  import('@/modules/operation-center').then(
    ({ OperationCenterComponent: Component }) => ({
      default: Component,
    }),
  ),
);

const menuItems: {
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  key: string;
}[] = [
  {
    label: '工作台',
    icon: <Icon component={Workbench} />,
    component: <P2PWorkbenchComponent />,
    key: 'workbench',
  },
  {
    label: '数据源管理',
    icon: <Icon component={DataSource} />,
    component: <DataSourceListComponent />,
    key: 'data-source',
  },
  {
    label: '数据管理',
    icon: <Icon component={DataManager} />,
    component: <DataManagerComponent />,
    key: 'data-management',
  },
  {
    label: '合作节点',
    icon: <Icon component={CooperativeNode} />,
    component: <CooperativeNodeListComponent />,
    key: 'connected-node',
  },
  {
    label: '我的项目',
    icon: <Icon component={projectManager} />,
    component: <P2pProjectListComponent />,
    key: 'my-project',
  },
  {
    label: '结果管理',
    icon: <Icon component={ResultManager} />,
    component: <ResultManagerComponent />,
    key: 'result',
  },
  {
    label: '沙箱管理',
    icon: <ExperimentOutlined />,
    component: <SandboxManagerComponent />,
    key: 'sandbox-manager',
  },
  {
    label: '资源管理',
    icon: <DashboardOutlined />,
    component: <ResourceManagerComponent />,
    key: 'resource-manager',
  },
  {
    label: '模型审批',
    icon: <SafetyCertificateOutlined />,
    component: <ModelApprovalComponent />,
    key: 'model-approval',
  },
  {
    label: '统一日志',
    icon: <FileSearchOutlined />,
    component: <UnifiedLogComponent />,
    key: 'unified-log',
  },
  {
    label: '系统对接',
    icon: <ApiOutlined />,
    component: <IntegrationManagerComponent />,
    key: 'integration-manager',
  },
  {
    label: '运维服务',
    icon: <ToolOutlined />,
    component: <OperationCenterComponent />,
    key: 'operation-center',
  },
];
const EdgePage = () => {
  const { search } = useLocation();
  const { ownerId } = parse(search);
  const homeLayoutService = useModel(HomeLayoutService);
  const messageService = useModel(MessageService);
  const nodeService = useModel(NodeService);

  const isAutonomyMode = hasAccess({ type: [Platform.AUTONOMY] });

  useEffect(() => {
    const getNodeList = async () => {
      const nodeList = await nodeService.listNode();
      if (ownerId) {
        const node = nodeList.find((n) => ownerId === n.nodeId);
        if (node) nodeService.setCurrentNode(node);
      }
    };
    const getMessageTotal = async () => {
      if (ownerId) {
        const res = await messageService.getMessageCount(ownerId as string);
        if (res.status) {
          homeLayoutService.setMessageCount(res?.data || 0);
        }
      }
    };
    homeLayoutService.setSubTitle('数据沙箱');
    if (!isAutonomyMode) {
      getNodeList();
    }
    // 获取未处理消息数量
    getMessageTotal();
  }, []);
  return (
    <HomeLayout>
      <ManagementLayoutComponent menuItems={menuItems} defaultTabKey={'workbench'} />
    </HomeLayout>
  );
};

export default EdgePage;
