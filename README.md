# Kuggamax

> New Kuggamax!

~ Kingwel

The new Kuggamax is a decentralized publishing platform.

## Design Principles

## Overview

Kuggamax is described by one smart contract:

`Kuggamax.sol` - Responsible for managing Lab & membership, item publishing & NFT minting.

Kuggamax is using an external ERC20 token, we called KMC, as the native token of Kuggamax.

Kuggamax is using ERC1155 to mint item NFT.

## Installation

To install this project run `npm install`.

## Testing

For Kuggamax unit test, you could run the hardhat test command.

```
npx hardhat test
```

## Deploying and interacting with Kuggamax

This project includes Hardhat tasks for deploying and using Kuggamax.

### Deployment

#### Deploying a new Kuggamax

Follow these instructions to deploy a new instance:

1. Edit `hardhat.config.js`, setting the values for `INFURA_API_KEY` and `MAINNET_PRIVATE_KEY`.
2. Edit `deployment-params.js`, setting your desired deployment parameters.
3. Run `npx hardhat kuggamax-deploy --network mainnet` .
4. Edit `hardhat.config.js`, setting the address of the Kuggamax in `networks.mainnet.deployedContracts.kuggamax`.

### Interacting with the smart contracts

This project has tasks to work with Kuggamax contracts. To use them, you should first follow these instructions:

1. Edit `hardhat.config.js`, setting the values for `INFURA_API_KEY` and `MAINNET_PRIVATE_KEY`.
2. Make sure you have the right address in `hardhat.config.js`'s `networks.mainnet.deployedContracts.kuggamax` field.

```
npx hardhat kuggamax-deploy-task 

npx hardhat deposit --amount 0.1

npx hardhat create-lab --title no1

npx hardhat create-item --lab 1

npx hardhat mint --item 1

npx hardhat add-member --lab 1 --member 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199

npx hardhat remove-member --lab 1 --member 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199

npx hardhat withdraw --amount 2

npx hardhat debug

npx hardhat permit-approve --amount 1

npx hardhat permit-create-lab --title MyLab1

npx hardhat permit-create-item --labid 2
 
npx hardhat permit-mint --itemid 2 --amount 3
```

