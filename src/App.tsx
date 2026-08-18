import { useEffect, useState } from 'react'
import type { AppView, Material, SavedCalculation } from './types'
import { loadMaterials, loadCalculations, saveMaterials } from './lib/storage'
import { Header } from './components/Header'
import { Home } from './views/Home'
import { Calculator } from './views/Calculator'
import { CatalogView } from './views/CatalogView'
import { MaterialsView } from './views/MaterialsView'
import { HistoryView } from './views/HistoryView'
import './App.css'

function App() {
  const [view, setView] = useState<AppView>('home')
  const [materials, setMaterials] = useState<Material[]>(() => loadMaterials())
  const [history, setHistory] = useState<SavedCalculation[]>(() => loadCalculations())
  const [preselectId, setPreselectId] = useState<string | null>(null)

  useEffect(() => {
    saveMaterials(materials)
  }, [materials])

  const openCalculator = (catalogId?: string) => {
    setPreselectId(catalogId ?? null)
    setView('calculator')
  }

  const refreshHistory = () => setHistory(loadCalculations())

  return (
    <div className="app-shell">
      <div className="bg-grid" aria-hidden />
      <Header view={view} onNavigate={setView} />
      <main className="main">
        {view === 'home' && (
          <Home
            onStart={() => openCalculator()}
            onCustom={() => openCalculator('custom')}
            onCatalog={() => setView('catalog')}
          />
        )}
        {view === 'calculator' && (
          <Calculator
            materials={materials}
            preselectId={preselectId}
            onSaved={refreshHistory}
            onOpenHistory={() => setView('history')}
          />
        )}
        {view === 'catalog' && (
          <CatalogView onCalculate={openCalculator} />
        )}
        {view === 'materials' && (
          <MaterialsView materials={materials} onChange={setMaterials} />
        )}
        {view === 'history' && (
          <HistoryView
            items={history}
            materials={materials}
            onChange={refreshHistory}
            onRecalculate={(id) => openCalculator(id)}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>ОпораСчёт · MVP калькуляции скользящих опор</span>
        <span>Цены справочника на дату актуализации карточки</span>
      </footer>
    </div>
  )
}

export default App
