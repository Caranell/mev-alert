![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Jest](https://img.shields.io/badge/-jest-%23C21325?style=for-the-badge&logo=jest&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B3263?style=for-the-badge&logo=eslint&logoColor=white)
![Yarn](https://img.shields.io/badge/yarn-%232C8EBB.svg?style=for-the-badge&logo=yarn&logoColor=white)

# Venn MEV custom detector

This project implements a custom detector designed to identify potential MEV activities, specifically focusing on sandwich attacks

[What is a sandwich attack](https://trustwallet.com/blog/security/what-are-sandwich-attacks-in-defi)

**Detection Logic:**

The detection service (`src/modules/detection-module/service.ts`) analyzes transaction traces based on several heuristics:

1. **EOA wallet call to contract, which triggers internal calls** Sandwich transactions, as well as other types of MEV, require creating custom smart contracts. In sandwiches, contracts should be able to trade tokens using different DEX pools
2.  **Presence of Swaps:** Detecor checks if the transaction trace contains calls to known swap functions (e.g., Uniswap V2/V3/V4, 1inch V5).
3.  **Tokens Flow:** Detector verifies, that the transaction is not just a sophisticatedly-routed swap, by checking that no tokens traded are returned to original contract caller (it's a common practice among MEV bots as it allows to save a lot of gas by not transferring tokens back to the 'owner' and keeping them inside contract)
4.  **Contract Verification (Optional):** If an `ETHERSCAN_API_KEY` is provided, it checks if the supposed MEV contract is verified on Etherscan. MEV bots ony use unverified contracts, whereas DeFi protocols usually verify theirs.

A transaction is flagged as a potential sandwich attack only if all of the aforementioned heuristics apply to it.

_P.S. This detector focuses on sanwich attacks, but most of these checks can be used for detecting other types of mev_

## Table of Contents
- [Local development:](#️-local-development)
- [Deploy to production](#-deploy-to-production)

## Example transactions

Transactions from known MEV bots that can be used to trigger the detector:
  - https://etherscan.io/tx/0xf69e27bafd0c63b57fa7620e7f0254449112512fd0d60980bde56a199ec1569f
  - https://etherscan.io/tx/0xe43c09e4521e09a8cfb197d301581c4f118203a54199d28a720f7a5aee51ee96
  - https://etherscan.io/tx/0x2f073bcb335c0d50dd901d93201b5ce9257d15b2882f2624003dd4c3d59351b8
  - https://etherscan.io/tx/0x962601a08d650fd8eb66fd4391af3993fad6babd201c1198a255b6ad5fa1bbbe

## 🛠️ Local Development

**Environment Setup**

Create a `.env` file with:

```bash
PORT=3000
HOST=localhost
LOG_LEVEL=debug
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

**Runing In Dev Mode**
```bash
yarn        # or npm install
yarn dev    # or npm run dev
```

## 🚀 Deploy To Production

**Manual Build**

```bash
yarn build      # or npm run build
yarn start      # or npm run start
```


**Using Docker**
```bash
docker build -f Dockerfile . -t my-custom-detector
```

