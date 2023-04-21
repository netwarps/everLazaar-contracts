const {expect} = require("chai")
const {task} = require("hardhat/config")
const Confirm = require("prompt-confirm")
const {
  deployAllByProxy,
  getDeployedContracts,
  getDeployedMainContractName,
  getDeployedToken20Name,
  getDeployedToken1155Name,
  setDeployedMainContractName,
  setDeployedToken20Name,
  setDeployedToken1155Name
} = require("../scripts/utils")



async function upgradeContract(hre, newContractName) {
  await hre.run('compile')

  const { mainContract, kmcToken, token1155 } = await getDeployedContracts(hre)
  let prevContractProxyAddr = mainContract.address

  console.log('Upgrading new version [%s] contract to network [%s] by script:', newContractName, hre.network.name)
  console.log('Make sure the previous version contract has been deployed in this network.')
  console.log('Make sure the correct Main contract Proxy address has been configured in [hardhat.config.js]')

  const oldMainContractName = getDeployedMainContractName()
  const oldToken20ContractName = getDeployedToken20Name()
  const oldToken1155ContractName = getDeployedToken1155Name()

  console.log('')
  console.log('Old [%s] Proxy addr:', oldMainContractName, mainContract.address)
  console.log('Old [%s] Proxy addr:', oldToken20ContractName, kmcToken.address)
  console.log('Old [%s] Proxy addr:', oldToken1155ContractName, token1155.address)
  console.log('New name:', newContractName)

  if (mainContract === undefined || kmcToken === undefined || token1155 === undefined) {
    console.log('get Proxy addr failed !!')
    return false
  }

  const prompt = new Confirm('Please confirm above info are exactly correct ?')
  const confirmation = await prompt.run()

  if (!confirmation) {
    console.log('You aborted the procedure !!')
    return false
  }

  const lowNewName = newContractName.toLowerCase()

  if (lowNewName.indexOf(oldToken20ContractName) >= 0) {
    prevContractProxyAddr = kmcToken.address
    console.log('will upgrade [%s]', oldToken20ContractName)
  } else if (lowNewName.indexOf(oldToken1155ContractName) >= 0) {
    console.log('will upgrade [%s]', oldToken1155ContractName)
    prevContractProxyAddr = token1155.address
  } else if (lowNewName.indexOf(oldMainContractName) >= 0) {
    prevContractProxyAddr = mainContract.address
    console.log('will upgrade [%s]', oldMainContractName)
  } else {
    console.log('newContractName may be NOT correct, please check !!')
    return false
  }

  console.log('prevContractProxyAddr:', prevContractProxyAddr)

  const [admin] = await hre.ethers.getSigners()

  console.log("Upgrading contracts with the account:", admin.address)
  console.log("Deployer native token balance:", (await admin.getBalance()).toString())

  const NewFactory = await hre.ethers.getContractFactory(newContractName)
  const newContractProxy = await hre.upgrades.upgradeProxy(prevContractProxyAddr, NewFactory)

  console.log('New proxy addr:', newContractProxy.address)
  expect(newContractProxy.address).to.equals(prevContractProxyAddr)

  console.log('')
  console.log('Upgraded [%s] to network[%s], chainId[%d] succeed !!!', newContractName, hre.network.name, await newContractProxy.signer.getChainId())

  return true
}

/**
 * This task using proxy to deploy Main contract, Token20, Token1155 contracts to test or formal network for the first time.
 */
task("deploy-all-proxy", 'Deploys new instance of Main contract,Token20,Token1155 to network by Proxy')
  .setAction(async (_, hre) => {

    console.log('Deploying all contracts to network[%s] by Proxy', hre.network.name)
    console.log('Only used for deploying FIRST TIME !!! If you want to upgrade the contract, please choose upgrade task.')

    const prompt = new Confirm('Continue to deploy ?')
    const confirmation = await prompt.run()

    if (!confirmation) {
      console.log('You aborted the procedure !!')
      return
    }

    const [admin] = await hre.ethers.getSigners()

    console.log("Deploying contracts with the account:", admin.address)
    console.log("Deployer native token balance:", (await admin.getBalance()).toString())

    const {mainContract, kmcToken, accounts, chainId} = await deployAllByProxy(true, hre)

    await kmcToken.transfer(mainContract.address, await kmcToken.totalSupply())

    const mainContractName = getDeployedMainContractName()
    console.log('')
    console.log('[%s] deployed. Address:', mainContractName, mainContract.address)
    console.log('KMC in [%s]:', mainContractName, hre.ethers.utils.formatEther(await kmcToken.balanceOf(mainContract.address)))
    console.log('Deployed [%s], Token20, Token1155 to network[%s], chainId[%d] succeed ...', mainContractName, hre.network.name, chainId)
    console.log('--------------------------------------------------------------------------------')
    console.log("Set this address in hardhat.config.js's networks section to use the other tasks !!!")
    console.log('--------------------------------------------------------------------------------')

  })

/**
 * This task is used to deploy Main,Token20,Token1155 contracts to test or formal network for the first time.
 * eg: npx hardhat upgrade-contract --network localhost --new-contract-name 'Token20V2'
 * eg: npx hardhat upgrade-contract --network localhost --new-contract-name 'Token1155V2'
 * eg: npx hardhat upgrade-contract --network localhost --new-contract-name 'MainV2'
 */
task("upgrade-contract", 'Upgrades a specified contract to network')
  .addParam('newContractName', 'The name of the new contract ' +
    '\neg: npx hardhat upgrade-contract --network localhost --newContractName \'Token20\'')
  .setAction(async ({newContractName}, hre) => {
    console.log('Upgrading contract[%s] to network [%s]', newContractName, hre.network.name)

    if (!await upgradeContract(hre, newContractName)) {
      console.log('Upgrading contract failed !!!')
      return
    }
    console.log('\nUpgrading contract succeed !!\n')
  })

//eg: npx hardhat upgrade-test --network localhost --new-contract-name Token20
task("upgrade-test", 'Tests the contract after upgrading a specified contract to network')
  .addParam('curMainContractName', 'The name of the current main contract ')
  .addParam('curToken20Name', 'The name of the current Token20 contract ')
  .addParam('curToken1155Name', 'The name of the current Token1155 contract ')
  .setAction(async ({curMainContractName, curToken20Name, curToken1155Name}, hre) => {
    console.log('Testing the upgraded contract in network [%s]', hre.network.name)

    if (curMainContractName === undefined || curMainContractName === '') {
      console.log('invalid curMainContractName')
      return
    }
    if (curToken20Name === undefined || curToken20Name === '') {
      console.log('invalid curToken20Name')
      return
    }
    if (curToken1155Name === undefined || curToken1155Name === '') {
      console.log('invalid curToken1155Name')
      return
    }

    setDeployedMainContractName(curMainContractName)
    setDeployedToken20Name(curToken20Name)
    setDeployedToken1155Name(curToken1155Name)

    const {mainContract, kmcToken, token1155} = await getDeployedContracts(hre)

    expect(mainContract !== undefined)
    expect(kmcToken !== undefined)
    expect(token1155 !== undefined)

    const [admin] = await hre.ethers.getSigners()

    console.log('kmcToken version:', await kmcToken.version())
    await kmcToken.setVersion('v2')
    console.log('kmcToken version:', await kmcToken.version())
    console.log('token1155 total supply:', await token1155.totalSupply(admin.address))
    await mainContract.setVersion('v2')
    console.log('mainContract version:', await mainContract.version())
    // console.log('mainContract getX():', await mainContract.getX())
    console.log('\nTest contract succeed !!\n')
  })