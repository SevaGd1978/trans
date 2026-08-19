import type { AppView } from '../types'

const NAV: { id: AppView; label: string }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'calculator', label: 'Калькулятор' },
  { id: 'catalog', label: 'Каталог' },
  { id: 'materials', label: 'Материалы' },
  { id: 'history', label: 'История' },
]

interface Props {
  view: AppView
  onNavigate: (view: AppView) => void
}

export function Header({ view, onNavigate }: Props) {
  return (
    <header className="site-header">
      <button type="button" className="brand" onClick={() => onNavigate('home')}>
        <span className="brand-mark" aria-hidden />
        <span className="brand-text">
          <span className="brand-name">ОпораСчёт</span>
          <span className="brand-tag">себестоимость скользящих опор</span>
        </span>
      </button>
      <nav className="nav" aria-label="Основная навигация">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'nav-link is-active' : 'nav-link'}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
