interface Props {
  onStart: () => void
  onCatalog: () => void
}

export function Home({ onStart, onCatalog }: Props) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="brand-hero">ОпораСчёт</p>
        <h1>Себестоимость скользящей опоры — от типоразмера до калькуляции</h1>
        <p className="lede">
          Подберите опору из каталога ОСТ/ТУ, соберите BOM, заложите трудозатраты
          и получите полную себестоимость партии с выгрузкой в Excel.
        </p>
        <div className="cta-row">
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Рассчитать опору
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCatalog}>
            Открыть каталог
          </button>
        </div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <svg viewBox="0 0 640 420" className="hero-svg">
          <defs>
            <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8aa0b5" />
              <stop offset="55%" stopColor="#3d4f63" />
              <stop offset="100%" stopColor="#1f2a36" />
            </linearGradient>
          </defs>
          <rect x="40" y="310" width="560" height="26" rx="3" fill="url(#steel)" />
          <rect x="110" y="255" width="420" height="55" rx="5" fill="#2b3a4a" />
          <rect x="145" y="270" width="350" height="12" rx="2" fill="#c47a3a" opacity="0.92" />
          <rect x="205" y="145" width="230" height="110" rx="6" fill="url(#steel)" />
          <rect x="240" y="95" width="160" height="54" rx="26" fill="#516477" />
          <ellipse cx="320" cy="100" rx="68" ry="16" fill="#15202b" opacity="0.5" />
          <path
            d="M70 336 C190 250, 450 250, 570 336"
            fill="none"
            stroke="#c47a3a"
            strokeWidth="2"
            strokeDasharray="7 9"
            opacity="0.5"
          />
        </svg>
      </div>
    </section>
  )
}
