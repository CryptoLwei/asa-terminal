# ASA Terminal v1.1

A clean, beautiful **no-code terminal** for minting **Fungible Tokens** and **NFTs** on Algorand.

Built with **AlgoKit + Puya** — designed to be simple enough for beginners yet powerful for creators.

![ASA Terminal](https://github.com/CryptoLwei/asa-terminal/blob/main/preview.png)

## ✨ Features

- Dual mode: **Fungible Token** ↔ **NFT / Collectible**
- Full ARC-3 metadata support with IPFS (Pinata)
- Proper `metadata_hash` (sha512_256) for NFTs
- Automatic opt-in + claim supply flow
- Extra 0.3 ALGO MBR protection per mint (prevents contract from running dry)
- Modern dark terminal UI with sticky header and soft reset

### How It Works

| Mode              | Total     | Decimals | Metadata Style       | Wallet Behavior     |
|-------------------|-----------|----------|----------------------|---------------------|
| Fungible Token    | > 1       | > 0      | Minimal (no logo)    | **Overview** tab    |
| NFT               | 1         | 0        | Full ARC-3 + Logo    | **NFTs** tab        |

### Live Demo (TestNet)

→ **[Open ASA Terminal](https://cryptolwei.github.io/asa-terminal)**

### Quick Start

```bash
git clone https://github.com/CryptoLwei/asa-terminal.git
cd asa-terminal/asa-terminal-frontend
npm install
npm run dev

Tech Stack

Frontend: React + TypeScript + Vite + Tailwind CSS
Smart Contract: AlgoKit + Puya (ARC-4)
Storage: Pinata IPFS
Wallet: @txnlab/use-wallet-react

Open Source
This project is open source under the MIT License. Feel free to fork, improve, or build upon it.
