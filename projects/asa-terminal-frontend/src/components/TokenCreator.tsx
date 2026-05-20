// src/components/TokenCreator.tsx
import { AlgorandClient, microAlgo } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useCallback, useRef, useState } from 'react'
import { AsaTerminalClient } from '../contracts/AsaTerminal'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

/* =============================================================
   IPFS Upload Functions
   ============================================================= */
async function uploadToIPFS(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}` },
    body: formData,
  })
  const data = await res.json()
  if (!data.IpfsHash) throw new Error(`Pinata image upload failed: ${JSON.stringify(data)}`)
  return `ipfs://${data.IpfsHash}`
}

async function uploadMetadataToIPFS(metadata: object): Promise<string> {
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })
  const data = await res.json()
  if (!data.IpfsHash) throw new Error(`Pinata metadata upload failed: ${JSON.stringify(data)}`)
  return `ipfs://${data.IpfsHash}`
}

const toGateway = (uri: string) => uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')

const APP_ID = BigInt(762775667) // AsaTerminal v1.1 on Testnet

interface LogEntry {
  text: string
  type: 'info' | 'success' | 'error' | 'muted'
}

/* =============================================================
   MAIN COMPONENT - v1.1 (Fungible + NFT Toggle)
   ============================================================= */
const TokenCreator: React.FC = () => {
  const { activeAddress, transactionSigner } = useWallet()

  // Token Type Toggle
  const [tokenType, setTokenType] = useState<'fungible' | 'nft'>('fungible')

  const [tokenName, setTokenName] = useState('')
  const [ticker, setTicker] = useState('')
  const [supply, setSupply] = useState('1000000')
  const [decimals, setDecimals] = useState(6)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [logs, setLogs] = useState<LogEntry[]>([{
    text: '// ASA Terminal v1.1 ready. Choose Fungible Token or NFT mode.',
    type: 'muted'
  }])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Listen for reset event from header - IMPROVED
  React.useEffect(() => {
    const handleReset = () => {
      // Keep the current mode (don't switch back to fungible)
      setTokenName('')
      setTicker('')
      setSupply('1000000')
      setDecimals(6)
      setLogoFile(null)
      setLogoPreview(null)

      setLogs([{
        text: `// Ready for new ${tokenType.toUpperCase()} mint.`,
        type: 'muted'
      }])
    }

    window.addEventListener('reset-mint-form', handleReset)
    return () => window.removeEventListener('reset-mint-form', handleReset)
  }, [tokenType])   // ← important: depends on current mode

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [...prev, { text, type }])
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleFileDrop = useCallback((file: File) => {
    if (!file.type.match(/image\/(png|jpeg)/)) {
      addLog('ERROR: Only .png or .jpg files are accepted.', 'error')
      return
    }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileDrop(file)
  }

  /* =============================================================
     MAIN MINT FUNCTION
     ============================================================= */
    const handleMint = async () => {
    const sender = activeAddress
    const signer = transactionSigner

    if (!sender || !signer) {
      addLog('ERROR: Wallet not connected.', 'error')
      return
    }
    if (!tokenName || !ticker) {
      addLog('ERROR: Token Name and Ticker are required.', 'error')
      return
    }
    if (tokenType === 'fungible' && (!supply || Number(supply) <= 0)) {
      addLog('ERROR: Supply must be greater than 0 for Fungible Tokens.', 'error')
      return
    }

    setIsLoading(true)
    setLogs([{ text: `// Starting ${tokenType.toUpperCase()} mint pipeline...`, type: 'muted' }])

    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()

      addLog(`[ 1/4 ] Preparing ${tokenType === 'nft' ? 'NFT' : 'Fungible Token'} metadata...`, 'info')

      let assetUrl = ''
      let metadataHash = new Uint8Array(32).fill(0) // default empty for Fungible

      if (logoFile || tokenType === 'nft') {
        const imageUri = logoFile ? await uploadToIPFS(logoFile) : 'ipfs://placeholder'
        const arc3Metadata = {
          name: tokenName,
          unitName: ticker,
          decimals: tokenType === 'nft' ? 0 : decimals,
          // Public Pinata gateway → better logo display in Pera Wallet
          image: `https://gateway.pinata.cloud/ipfs/${imageUri.replace('ipfs://', '')}`,
          image_mimetype: logoFile?.type || 'image/png',
          properties: {
            creator: sender,
            type: tokenType.toUpperCase()
          },
        }
        const metadataUri = await uploadMetadataToIPFS(arc3Metadata)
        assetUrl = toGateway(metadataUri) + '#arc3'

        // Calculate sha512_256 hash for NFT
        if (tokenType === 'nft') {
          const { sha512_256 } = await import('js-sha512')
          const hashHex = sha512_256(JSON.stringify(arc3Metadata))
          metadataHash = new Uint8Array(Buffer.from(hashHex, 'hex'))
        }

        addLog(`✓ ${tokenType.toUpperCase()} metadata uploaded with #arc3`, 'success')
      } else {
        addLog('No logo → using minimal metadata for better FT display', 'info')
        assetUrl = ''
      }

      addLog('[ 2/4 ] Calling createAsset() on contract...', 'info')

      const algorand = AlgorandClient.fromConfig({
        algodConfig: {
          server: algodConfig.server,
          port: algodConfig.port ? Number(algodConfig.port) : 443,
          token: String(algodConfig.token),
        },
      })

      algorand.setDefaultSigner(signer)
      algorand.setSigner(sender, signer)

      const appClient = new AsaTerminalClient({
        appId: APP_ID,
        defaultSender: sender,
        defaultSigner: signer,
        algorand,
      })

      const total = tokenType === 'nft'
        ? BigInt(1)
        : BigInt(supply) * BigInt(10 ** decimals)

      const dec = BigInt(tokenType === 'nft' ? 0 : decimals)

      const EXTRA_MBR = microAlgo(300_000)

      addLog('Sending extra 0.3 ALGO to contract for MBR...', 'info')

      const mintResult = await appClient.send.createAsset({
        args: {
          assetName: tokenName,
          unitName: ticker,
          total: total,
          decimals: dec,
          url: assetUrl || '',
          metadataHash: Array.from(metadataHash),
        },
        extraFee: EXTRA_MBR,
     })

      const assetId = mintResult.return
      if (!assetId) throw new Error('No Asset ID returned from contract.')

      addLog(`[ 2/4 ] ✓ ${tokenType.toUpperCase()} created — ID: ${assetId}`, 'success')

      addLog('[ 3/4 ] Opting in to asset...', 'info')
      await algorand.send.assetOptIn({
        sender: sender,
        signer: signer,
        assetId: BigInt(assetId),
      })
      addLog(`[ 3/4 ] ✓ Opted in to Asset ID: ${assetId}`, 'success')

      addLog('[ 4/4 ] Claiming supply from contract...', 'info')
      await appClient.send.claimAsset({
        args: { asset: BigInt(assetId) },
        extraFee: microAlgo(1000),
      })

      addLog('[ 4/4 ] ✓ Supply delivered!', 'success')
      addLog('────────────────────────────────────────', 'muted')
      addLog('✓ MINT COMPLETE', 'success')
      addLog(`  Type      : ${tokenType.toUpperCase()}`, 'success')
      addLog(`  Asset ID  : ${assetId}`, 'success')
      addLog(`  Name      : ${tokenName} (${ticker})`, 'success')
      addLog(`  Explorer  : https://lora.algokit.io/testnet/asset/${assetId}`, 'success')

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      addLog(`ERROR: ${message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const logColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-emerald-400'
      case 'error':
        return 'text-red-400'
      case 'muted':
        return 'text-zinc-500'
      default:
        return 'text-zinc-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* TOKEN TYPE TOGGLE */}
      <div className="flex gap-3">
        <button
          onClick={() => setTokenType('fungible')}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${
            tokenType === 'fungible'
              ? 'bg-emerald-500 text-black'
              : 'border border-zinc-700 hover:border-zinc-500'
          }`}
        >
          Fungible Token
        </button>
        <button
          onClick={() => setTokenType('nft')}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${
            tokenType === 'nft'
              ? 'bg-emerald-500 text-black'
              : 'border border-zinc-700 hover:border-zinc-500'
          }`}
        >
          NFT / Collectible
        </button>
      </div>

      <div>
        <h1 className="text-emerald-400 text-sm tracking-widest mb-1">
          // TOKEN_CREATOR — {tokenType === 'fungible' ? 'FUNGIBLE MODE' : 'NFT MODE'}
        </h1>
        <p className="text-zinc-500 text-xs">
          No-code ASA minting via AsaTerminal · App {APP_ID.toString()}
        </p>
      </div>

      <div className="border border-zinc-800 bg-zinc-950 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-zinc-400 text-xs block mb-1">TOKEN NAME</label>
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g. Lwei Token"
              disabled={isLoading}
              className="w-full bg-black border border-zinc-700 focus:border-emerald-400 text-white text-sm px-3 py-2 outline-none transition-colors placeholder-zinc-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">
              TICKER SYMBOL <span className="text-zinc-600">(max 8)</span>
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="e.g. LWEI"
              disabled={isLoading}
              className="w-full bg-black border border-zinc-700 focus:border-emerald-400 text-white text-sm px-3 py-2 outline-none transition-colors placeholder-zinc-600 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Supply + Decimals - only for Fungible */}
        {tokenType === 'fungible' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-xs block mb-1">TOTAL SUPPLY</label>
              <input
                type="number"
                value={supply}
                onChange={(e) => setSupply(e.target.value)}
                disabled={isLoading}
                className="w-full bg-black border border-zinc-700 focus:border-emerald-400 text-white text-sm px-3 py-2 outline-none transition-colors disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs block mb-1">DECIMALS</label>
              <input
                type="number"
                min={0}
                max={19}
                value={decimals}
                onChange={(e) => setDecimals(Number(e.target.value))}
                disabled={isLoading}
                className="w-full bg-black border border-zinc-700 focus:border-emerald-400 text-white text-sm px-3 py-2 outline-none transition-colors disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {/* LOGO - Only show for NFT mode */}
        {tokenType === 'nft' && (
          <div>
            <label className="text-zinc-400 text-xs block mb-1">
              TOKEN LOGO <span className="text-zinc-600">(.png / .jpg) - Required for NFT</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed cursor-pointer transition-colors p-6 text-center ${isDragging ? 'border-emerald-400 bg-emerald-400/5' : 'border-zinc-700 hover:border-zinc-500'}`}
            >
              {logoPreview ? (
                <div className="flex items-center justify-center gap-4">
                  <img src={logoPreview} alt="preview" className="w-12 h-12 object-cover rounded" />
                  <span className="text-zinc-400 text-xs">{logoFile?.name}</span>
                </div>
              ) : (
                <p className="text-zinc-500 text-xs">Drag & drop logo here or click to browse</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileDrop(e.target.files[0])}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleMint}
          disabled={isLoading}
          className="w-full py-3 text-sm font-bold tracking-widest transition-all duration-200 border border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-emerald-400"
        >
          {isLoading
            ? '[ PROCESSING... ]'
            : `[ MINT ${tokenType === 'nft' ? 'NFT' : 'FUNGIBLE TOKEN'} ]`
          }
        </button>
      </div>

      {/* Terminal Logs */}
      <div className="border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-zinc-600 text-xs ml-2">terminal output</span>
        </div>
        <div className="p-4 h-48 overflow-y-auto space-y-1 font-mono text-xs">
          {logs.map((log, i) => (
            <div key={i} className={logColor(log.type)}>
              {log.type !== 'muted' && <span className="text-zinc-600 mr-2">&gt;</span>}
              {log.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  )
}

export default TokenCreator
