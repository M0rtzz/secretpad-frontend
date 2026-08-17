import Icon from '@ant-design/icons';
// import { Button } from 'antd';
import { ShowMenuContext, Portal } from '@secretflow/dag';
import classNames from 'classnames';
import { useState } from 'react';

import { ReactComponent as Fold } from '@/assets/fold.svg';
import { ReactComponent as Unfold } from '@/assets/unfold.svg';
import { MessageComponent } from '@/modules/message-center';
import { P2pProjectListComponent } from '@/modules/p2p-project-list';

import { GuidePipeline } from './component/guide-pipeline/ guide-pipeline';
import styles from './index.less';

export const P2PWorkbenchComponent = () => {
  const [isUnfold, setIsUnfold] = useState(true);
  const X6ReactPortalProvider = Portal.getProvider();
  return (
    <div className={styles.main}>
      <ShowMenuContext.Provider value={false}>
        <X6ReactPortalProvider />
      </ShowMenuContext.Provider>
      <div className={classNames(styles.mainContent, styles.header)}>
        <div className={classNames(styles.titleContent, styles.flexContent)}>
          <div className={styles.title}>
            <span className={styles.tea}>🍵</span>
            Hi～，欢迎来到HUSTNLP数据沙箱
          </div>
          <div
            className={styles.unfold}
            onClick={() => {
              setIsUnfold(!isUnfold);
            }}
          >
            <Icon component={isUnfold ? Unfold : Fold} />
            <span className={styles.unfoldTitle}>{isUnfold ? '展开' : '收起'}</span>
          </div>
        </div>
        <div className={classNames(styles.titleDescContent, styles.flexContent)}>
          <div className={styles.titleDesc}>科技护航数据安全，开源加速数据流通</div>
          {/* 暂无 */}
          {/* <div>
            <Button size="small" type="primary" shape="round">
              立即体验Demo
            </Button>
            <Button
              size="small"
              type="link"
              onClick={() => {
                const a = document.createElement('a');
                // todo 补充操作文档地址
                a.href = '';
                a.target = '_blank';
                a.click();
              }}
            >
              查看操作文档
            </Button>
          </div> */}
        </div>
        {!isUnfold && (
          <div className={styles.unfoldContent}>
            <div className={styles.unfoldDesc}>一张图看懂概念关系与任务流程</div>
            <div className={styles.graph}>
              <GuidePipeline />
            </div>
          </div>
        )}
      </div>
      <div className={classNames(styles.mainContent, styles.message)}>
        <div className={styles.eventTitle}>申请事项</div>
        <div className={styles.messageCard}>
          <MessageComponent />
        </div>
      </div>
      <div className={classNames(styles.mainContent, styles.project)}>
        <P2pProjectListComponent />
      </div>
    </div>
  );
};
