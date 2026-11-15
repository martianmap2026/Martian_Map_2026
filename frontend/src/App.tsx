import { useEffect, useState } from 'react'
import { supabase } from './services/supabaseClient'
import { Navbar } from './components/Navbar'
import { HomeLanding } from './components/HomeLanding'
import { RegionalView } from './components/RegionalView'
import { InvestigationView } from './components/InvestigationView'
import './App.css'

function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'region' | 'investigation'>('home')
  const [molaCount, setMolaCount] = useState<number | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const { count, error } = await supabase
          .from('mola_footprints')
          .select('id', { count: 'exact', head: true })

        if (!error && count !== null) {
          setMolaCount(count)
        }
      } catch (err) {
        console.error('Error de conexión:', err)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="mars-app">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <main className="mars-content">
        {currentTab === 'home' && (
          <HomeLanding onSelectRoute={(route) => setCurrentTab(route)} />
        )}
        {currentTab === 'region' && (
          <RegionalView molaCount={molaCount} />
        )}
        {currentTab === 'investigation' && (
          <InvestigationView />
        )}
      </main>
    </div>
  )
}

export default App