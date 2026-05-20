import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { AsaTerminalClient } from '../contracts/AsaTerminal'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

interface AppCallsInterface {
  openModal: boolean
  setModalState: (value: boolean) => void
}

const APP_ID = 762542762n // Your deployed TestNet App ID

const AppCalls = ({ openModal, setModalState }: AppCallsInterface) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [assetName, setAssetName] = useState<string>('')
  const [unitName, setUnitName] = useState<string>('')
  const [total, setTotal] = useState<string>('')
  const [decimals, setDecimals] = useState<string>('0')
  const [url, setUrl] = useState<string>('')

  const { enqueueSnackbar } = useSnackbar()
  const { transactionSigner, activeAddress } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
  algorand.setDefaultSigner(transactionSigner)

  const sendAppCall = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' })
      return
    }

    setLoading(true)

    // Connect to your already-deployed contract by App ID
    const appClient = algorand.client.getTypedAppClientById(AsaTerminalClient, {
      appId: APP_ID,
      defaultSender: activeAddress,
    })

    const response = await appClient.send
      .createAsset({
        args: {
          assetName: assetName,
          unitName: unitName,
          total: BigInt(total),
          decimals: BigInt(decimals),
          url: url,
        },
      })
      .catch((e: Error) => {
        enqueueSnackbar(`Error calling the contract: ${e.message}`, { variant: 'error' })
        setLoading(false)
        return undefined
      })

    if (!response) return

    enqueueSnackbar(`Asset created! Asset ID: ${response.return}`, { variant: 'success' })
    setLoading(false)
  }

  return (
    <dialog id="appcalls_modal" className={`modal ${openModal ? 'modal-open' : ''} bg-slate-200`}>
      <form method="dialog" className="modal-box">
        <h3 className="font-bold text-lg">Create a new ASA</h3>
        <br />
        <input
          type="text"
          placeholder="Asset Name (e.g. My Token)"
          className="input input-bordered w-full mb-2"
          value={assetName}
          onChange={(e) => setAssetName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Unit Name (e.g. MTK)"
          className="input input-bordered w-full mb-2"
          value={unitName}
          onChange={(e) => setUnitName(e.target.value)}
        />
        <input
          type="number"
          placeholder="Total Supply (e.g. 1000000)"
          className="input input-bordered w-full mb-2"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
        <input
          type="number"
          placeholder="Decimals (e.g. 0)"
          className="input input-bordered w-full mb-2"
          value={decimals}
          onChange={(e) => setDecimals(e.target.value)}
        />
        <input
          type="text"
          placeholder="URL (e.g. https://example.com/token.json)"
          className="input input-bordered w-full mb-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="modal-action">
          <button className="btn" onClick={() => setModalState(!openModal)}>
            Close
          </button>
          <button className="btn" onClick={sendAppCall}>
            {loading ? <span className="loading loading-spinner" /> : 'Create Asset'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default AppCalls
