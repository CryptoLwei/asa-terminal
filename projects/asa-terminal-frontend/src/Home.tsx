// src/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import TokenCreator from './components/TokenCreator'

const Home: React.FC = () => {
  const [openWalletModal, setOpenWalletModal] = useState(false)
  const { activeAddress } = useWallet()

  const toggleWalletModal = () => setOpenWalletModal(!openWalletModal)

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header - Sticky */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-black">

        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 text-lg font-bold tracking-widest">ASA_TERMINAL</span>
          <span className="text-zinc-600 text-xs">v1.1 // TESTNET</span>
        </div>

        {/* Center: New Mint Button */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('reset-mint-form'))
            }}
            className="text-xs border border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black px-4 py-2 transition-all duration-200 font-medium"
          >
            [ NEW MINT ]
          </button>
        </div>

        {/* Right: Wallet */}
        <button
          onClick={toggleWalletModal}
          className="text-xs border border-zinc-700 hover:border-emerald-400 hover:text-emerald-400 px-4 py-2 transition-colors duration-200"
        >
          {activeAddress ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}` : '[ CONNECT WALLET ]'}
        </button>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        {!activeAddress ? (
          <div className="text-center py-24">
            <p className="text-zinc-500 text-sm mb-2">// wallet not connected</p>
            <p className="text-zinc-400 text-xs mb-8">Connect your wallet to access the token minting terminal.</p>
            <button
              onClick={toggleWalletModal}
              className="border border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black px-8 py-3 text-sm transition-all duration-200"
            >
              CONNECT WALLET
            </button>
          </div>
        ) : (
          <TokenCreator />
        )}
      </main>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
  )
}

export default Home
