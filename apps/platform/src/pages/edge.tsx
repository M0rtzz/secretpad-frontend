import Icon from '@ant-design/icons';
import {
  ApiOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  CalculatorOutlined,
  CodeOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FundOutlined,
  PartitionOutlined,
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
import { DataUploadComponent } from '@/modules/data-upload';
import { DataCatalogComponent } from '@/modules/data-catalog';
import { UsageControlComponent } from '@/modules/usage-control';
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
const SandboxApprovalComponent = lazy(() =>
  import('@/modules/sandbox-approval').then(
    ({ SandboxApprovalComponent: Component }) => ({
      default: Component,
    }),
  ),
);
const DataGovernanceComponent = lazy(() =>
  import('@/modules/data-governance').then(
    ({ DataGovernanceComponent: Component }) => ({
      default: Component,
    }),
  ),
);
const DataComputeHomeComponent = lazy(() =>
  import('@/modules/data-compute').then(({ DataComputeHomeComponent: Component }) => ({
    default: Component,
  })),
);
const SandboxDevelopmentComponent = lazy(() =>
  import('@/modules/data-compute').then(
    ({ SandboxDevelopmentComponent: Component }) => ({ default: Component }),
  ),
);
const CustomAlgorithmComponent = lazy(() =>
  import('@/modules/data-compute').then(({ CustomAlgorithmComponent: Component }) => ({
    default: Component,
  })),
);
const ModelingComponentsComponent = lazy(() =>
  import('@/modules/data-compute').then(
    ({ ModelingComponentsComponent: Component }) => ({ default: Component }),
  ),
);
const VisualModelingComponent = lazy(() =>
  import('@/modules/data-compute').then(({ VisualModelingComponent: Component }) => ({
    default: Component,
  })),
);
const ModelReportsComponent = lazy(() =>
  import('@/modules/data-compute').then(({ ModelReportsComponent: Component }) => ({
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
  component?: React.ReactNode;
  key: string;
  children?: any[];
}[] = [
  {
    label: '我的项目',
    icon: <Icon component={projectManager} />,
    component: <P2pProjectListComponent />,
    key: 'my-project',
  },
  {
    label: '数据管理',
    icon: <Icon component={DataManager} />,
    key: 'data-management',
    children: [
      {
        label: '数据上传',
        key: 'data-upload',
        icon: <Icon component={DataSource} />,
        component: <DataUploadComponent />,
      },
      {
        label: '数据目录',
        key: 'data-catalog',
        icon: <Icon component={DataManager} />,
        component: <DataCatalogComponent />,
      },
      {
        label: '数据抽样与脱敏',
        key: 'data-governance',
        icon: <DeploymentUnitOutlined />,
        component: <DataGovernanceComponent />,
      },
      {
        label: '使用控制',
        key: 'usage-control',
        icon: <SafetyCertificateOutlined />,
        component: <UsageControlComponent />,
      },
    ],
  },
  {
    label: '资源管理',
    icon: <DashboardOutlined />,
    key: 'resource-management',
    children: [
      {
        label: '沙箱资源申请',
        key: 'sandbox-resource-application',
        icon: <ExperimentOutlined />,
        component: <SandboxManagerComponent />,
      },
      {
        label: '项目资源审核',
        key: 'sandbox-resource-review',
        icon: <AuditOutlined />,
        component: <SandboxApprovalComponent />,
      },
      {
        label: '资源监控',
        key: 'resource-monitor',
        icon: <DashboardOutlined />,
        component: <ResourceManagerComponent />,
      },
    ],
  },
  {
    label: '数据计算',
    icon: <CalculatorOutlined />,
    key: 'data-compute',
    children: [
      {
        label: '数据计算首页',
        key: 'data-compute-home',
        icon: <DashboardOutlined />,
        component: <DataComputeHomeComponent />,
      },
      {
        label: '沙箱方式开发',
        key: 'data-compute-dev',
        icon: <CodeOutlined />,
        component: <SandboxDevelopmentComponent />,
      },
      {
        label: '自定义算法',
        key: 'data-compute-algorithm',
        icon: <FundOutlined />,
        component: <CustomAlgorithmComponent />,
      },
      {
        label: '建模组件',
        key: 'data-compute-components',
        icon: <AppstoreOutlined />,
        component: <ModelingComponentsComponent />,
      },
      {
        label: '可视化建模',
        key: 'data-compute-visual',
        icon: <PartitionOutlined />,
        component: <VisualModelingComponent />,
      },
      {
        label: '模型报告信息',
        key: 'data-compute-report',
        icon: <BarChartOutlined />,
        component: <ModelReportsComponent />,
      },
    ],
  },
  {
    label: '工作台',
    icon: <Icon component={Workbench} />,
    component: <P2PWorkbenchComponent />,
    key: 'workbench',
  },
  {
    label: '合作节点',
    icon: <Icon component={CooperativeNode} />,
    component: <CooperativeNodeListComponent />,
    key: 'connected-node',
  },
  {
    label: '结果管理',
    icon: <Icon component={ResultManager} />,
    component: <ResultManagerComponent />,
    key: 'result',
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
      <ManagementLayoutComponent menuItems={menuItems} defaultTabKey={'my-project'} />
    </HomeLayout>
  );
};

export default EdgePage;
