import React from 'react'
import Bubbles from './components/Bubbles.jsx'

export default function App() {
  return (
    <div className="min-h-screen text-slate-100">
      <header className="px-4 py-3 border-b border-white/10 bg-slate-900/60 sticky top-0 backdrop-blur">
        <h1 className="text-lg font-semibold">Matter Bubbles Starter</h1>
        <p className="text-xs text-slate-400">React + Matter.js + Tailwind scaffold</p>
      </header>
      <main className="p-4">
        <div className="rounded-2xl overflow-hidden border border-white/10">
          <Bubbles />
        </div>
      </main>
    </div>
  )
}
