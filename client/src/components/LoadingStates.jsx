const SLOT_REELS = [
  ['1930', '1958', '1970', '1986', '1998', '2002', '2010', '2014', '2018', '2022', '2026'],
  ['巴西', '法国', '阿根廷', '德国', '西班牙', '意大利', '英格兰', '荷兰', '葡萄牙', '乌拉圭'],
  ['冠军队', '黄金一代', '东道主', '黑马', '防反大师', '技术流', '南美节奏', '欧洲铁军'],
];

const SLOT_REELS_EN = [
  SLOT_REELS[0],
  ['Brazil', 'France', 'Argentina', 'Germany', 'Spain', 'Italy', 'England', 'Netherlands', 'Portugal', 'Uruguay'],
  ['Champions', 'Golden Gen', 'Hosts', 'Dark Horse', 'Low Block', 'Technicians', 'South Rhythm', 'Euro Steel'],
];

export function SlotMachine({ title = '摇号中', subtitle = '正在匹配年代、国家与可用名单', lang = 'zh' }) {
  const reels = lang === 'en' ? SLOT_REELS_EN : SLOT_REELS;
  return (
    <div className="slot-machine" role="status" aria-live="polite">
      <div className="slot-machine-head">
        <span>{title}</span>
        <small>{subtitle}</small>
      </div>
      <div className="slot-reels">
        {reels.map((items, index) => (
          <div className="slot-reel" key={index}>
            <div className="slot-strip" style={{ '--reel-index': index }}>
              {[...items, ...items].map((item, itemIndex) => (
                <span key={`${item}-${itemIndex}`}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="slot-machine-foot">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function LoadingSteps({ title, steps = [], compact = false }) {
  return (
    <div className={`loading-steps ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      {title && <strong>{title}</strong>}
      <div className="loading-step-list">
        {steps.map((step, index) => (
          <span key={step} style={{ '--step-index': index }}>
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RosterSkeleton({ lang = 'zh' }) {
  return (
    <div className="roster-skeleton" role="status" aria-live="polite">
      <LoadingSteps
        compact
        title={lang === 'en' ? 'Loading Roster' : '正在加载名单'}
        steps={lang === 'en' ? ['Reading full roster', 'Checking display names', 'Verifying positions'] : ['读取完整名单', '补全中文名', '校验真实位置']}
      />
      {Array.from({ length: 6 }, (_, index) => (
        <div className="skeleton-player" key={index}>
          <span />
          <div>
            <b />
            <small />
          </div>
          <em />
        </div>
      ))}
    </div>
  );
}
