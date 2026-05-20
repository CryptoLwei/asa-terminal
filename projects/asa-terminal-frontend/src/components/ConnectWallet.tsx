import { useWallet, Wallet, WalletId } from '@txnlab/use-wallet-react'
import Account from './Account'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { wallets, activeAddress } = useWallet()

  const isKmd = (wallet: Wallet) => wallet.id === WalletId.KMD

  // Dynamic network display
  const activeWallet = wallets?.find((w) => w.isActive)
  const networkName = activeWallet?.network || 'testnet'
  const networkDisplay = networkName === 'testnet'
    ? 'TestNet'
    : networkName === 'mainnet'
      ? 'MainNet'
      : networkName === 'localnet'
        ? 'LocalNet'
        : networkName.toUpperCase()

  return (
    <dialog id="connect_wallet_modal" className={`modal ${openModal ? 'modal-open' : ''}`}>
      <form method="dialog" className="modal-box bg-zinc-950 border border-zinc-700 max-w-md">

        {/* Title */}
        <h3 className="font-bold text-emerald-400 text-xl tracking-widest mb-1">
          CONNECT WALLET
        </h3>
        <p className="text-zinc-400 text-sm mb-5">
          Choose a wallet to connect to ASA_TERMINAL
        </p>

        {/* Current info when connected */}
        {activeAddress && (
          <div className="bg-black border border-zinc-800 rounded-lg p-4 mb-6">
            <p className="text-emerald-400 text-xs mb-1">CONNECTED</p>
            <p className="font-mono text-white text-sm">
              {activeAddress.slice(0, 8)}...{activeAddress.slice(-6)}
            </p>
            <p className="text-zinc-400 text-xs mt-3">
              Network: <span className="text-emerald-300">{networkDisplay}</span>
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {!activeAddress &&
            wallets?.map((wallet) => (
              <button
                key={`provider-${wallet.id}`}
                data-test-id={`${wallet.id}-connect`}
                onClick={() => wallet.connect()}
                className="flex items-center gap-3 px-4 py-3 bg-black border border-zinc-700 hover:border-emerald-400 hover:text-emerald-400 transition-colors rounded-lg text-left"
              >
                {!isKmd(wallet) && (
                  <img
                    alt={`wallet_icon_${wallet.id}`}
                    src={wallet.metadata.icon}
                    style={{ objectFit: 'contain', width: '28px', height: '28px' }}
                  />
                )}
                <span className="font-medium">
                  {isKmd(wallet) ? 'LocalNet Wallet' : wallet.metadata.name}
                </span>
              </button>
            ))}
        </div>

        {/* Action buttons */}
        <div className="modal-action mt-8 flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 py-3 text-sm border border-zinc-700 hover:border-zinc-500 transition-colors"
          >
            CLOSE
          </button>

          {activeAddress && (
            <button
              onClick={async () => {
                if (wallets) {
                  const activeWallet = wallets.find((w) => w.isActive)
                  if (activeWallet) {
                    await activeWallet.disconnect()
                  } else {
                    localStorage.removeItem('@txnlab/use-wallet:v3')
                    window.location.reload()
                  }
                }
                closeModal()
              }}
              className="flex-1 py-3 text-sm bg-red-500/10 border border-red-500 text-red-400 hover:bg-red-500 hover:text-black transition-colors"
            >
              LOGOUT
            </button>
          )}
        </div>
      </form>

      {/* Click outside to close */}
      <form method="dialog" className="modal-backdrop">
        <button onClick={closeModal}>close</button>
      </form>
    </dialog>
  )
}

export default ConnectWallet
