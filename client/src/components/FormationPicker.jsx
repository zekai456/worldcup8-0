// Step 2: choose a formation before drafting.
export default function FormationPicker({ formations, onConfirm, language = 'zh', t }) {
  return (
    <div className="card">
      <h2 className="title sm">{t('formationTitle')}</h2>
      <p className="muted center">{t('formationSub')}</p>
      <div className="formation-grid">
        {formations.map((f) => (
          <button key={f.name} className="formation-card" onClick={() => onConfirm(f)}>
            <MiniPitch slots={f.slots} />
            <div className="fname">{f.name}</div>
            <div className="fdesc">{language === 'en' ? formationDescEn(f.desc) : f.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formationDescEn(desc) {
  const map = {
    '经典平衡，攻守稳健': 'Classic balance, steady at both ends',
    '全攻全守，边路狂飙': 'Total football with aggressive wide play',
    '中场绞杀，控制力强': 'Midfield press with strong control',
    '防守反击，大巴战术': 'Deep block and counter-attacks',
    '双后腰保护，三前腰支援单箭头': 'Double pivot shielding three creators behind one striker',
    '菱形中场，双前锋压迫禁区': 'Diamond midfield with two strikers attacking the box',
    '三中卫托底，前场三叉戟': 'Back three platform for a front three',
    '三中场覆盖，前腰连接双前锋': 'Three midfielders plus a creator behind two forwards',
    '五后卫稳守，双前锋反击': 'Five-man defence with two forwards on the break',
  };
  return map[desc] || desc;
}

function MiniPitch({ slots }) {
  return (
    <div className="mini-pitch">
      {slots.map((s) => (
        <span
          key={s.id}
          className="mini-dot"
          style={{ left: `${s.x}%`, bottom: `${s.y}%` }}
        />
      ))}
    </div>
  );
}
