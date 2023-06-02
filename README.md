# Everlazaar

The Everlazaar is a decentralized career social creation publishing platform.

## Design Principles

## Overview

Everlazaar is described by one smart contract:

`Everlazaar.sol` - Responsible for managing creation publishing & NFT minting.

Everlazaar is using an external ERC20 based token, we called KMC, as the native token of Everlazaar.

Everlazaar is using ERC1155 based contract to mint creation NFT.

## Installation

To install this project run `npm install`.

## Testing

Before run test, make sure a local hardhat node was running.

```
npx hardhat node
```

For Everlazaar unit test, you could run the hardhat test command.

```
npx hardhat test
```

## Deploying and interacting with Everlazaar

This project includes Hardhat tasks for deploying and using Everlazaar.

### Deployment

#### Deploying a new Everlazaar

Follow these instructions to deploy a new instance:

1. Edit `hardhat.config.js`, setting the values for `INFURA_API_KEY` and `MAINNET_PRIVATE_KEY`.
2. Edit `deployment-params.js`, setting your desired deployment parameters.
3. Run `npx hardhat deploy-all-proxy --network mainnet` .
4. Edit `hardhat.config.js`, setting the address of the Everlazaar in `networks.mainnet.deployedContracts.kuggamax`.

### Interacting with the smart contracts

This project has tasks to work with Everlazaar contracts. To use them, you should first follow these instructions:

1. Edit `hardhat.config.js`, setting the values for `INFURA_API_KEY` and `MAINNET_PRIVATE_KEY`.
2. Make sure you have the right address in `hardhat.config.js`'s `networks.mainnet.deployedContracts.kuggamax` field.

```

npx hardhat deploy-all-proxy

npx hardhat deposit --amount 0.002

npx hardhat withdraw --amount 1

npx hardhat set-article-deposit --amount 0.02

npx hardhat set-mint-deposit --amount 0.2

npx hardhat debug

npx hardhat permit-approve --amount 1

npx hardhat permit-create-article
 
npx hardhat permit-mint --article-contract-id 1 --amount 3

```

