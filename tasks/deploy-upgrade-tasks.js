const {expect} = require('chai')
const {task} = require('hardhat/config')
const Confirm = require('prompt-confirm')
const {
  deployAllByProxy,
  getDeployedContracts,
  getDeployedMainContractName,
  getDeployedToken20Name,
  getDeployedToken1155Name,
  justWait,
  initToken20ContractName,
  initToken1155ContractName,
  initMainContractName
} = require('../scripts/utils')
const {UpgradeProxyOptions} = require("@openzeppelin/hardhat-upgrades/dist/utils");
const deploymentParams = require("./deployment-params");



async function upgradeContract(hre, newContractName, newVersion) {
  await hre.run('compile')

  const { mainContract, kmcToken, token1155 } = await getDeployedContracts(hre)
  let prevContract = mainContract

  console.log('Upgrading new version [%s] contract to network [%s] by script:', newContractName, hre.network.name)
  console.log('Make sure the previous version contract has been deployed in this network.')
  console.log('Make sure the correct Main contract Proxy address has been configured in [hardhat.config.js]')
  console.log('')

  const [deployer, account1] = await hre.ethers.getSigners()

  console.log('account0 :', deployer.address)
  console.log('account1 :', account1.address)
  console.log('')
  console.log('Upgrading contracts with the account:', deployer.address)
  console.log('Deployer native token balance:', (await deployer.getBalance()).toString())

  const oldMainContractName = getDeployedMainContractName()
  const oldToken20ContractName = getDeployedToken20Name()
  const oldToken1155ContractName = getDeployedToken1155Name()

  const lowNewName = newContractName.toLowerCase()
  let isToken1155 = false
  console.log('lowerNewName:%s', lowNewName)
  if (lowNewName.indexOf(oldToken20ContractName.toLowerCase()) >= 0) {
    prevContract = kmcToken
    console.log('will upgrade [%s]', oldToken20ContractName)
  } else if (lowNewName.indexOf(oldToken1155ContractName.toLowerCase()) >= 0) {
    console.log('will upgrade [%s]', oldToken1155ContractName)
    prevContract = token1155
    isToken1155 = true
  } else if (lowNewName.indexOf(oldMainContractName.toLowerCase()) >= 0) {
    prevContract = mainContract
    console.log('will upgrade [%s]', oldMainContractName)
  } else {
    console.log('newContractName may be NOT correct, please check !!')
    return false
  }

  const curInitializedVersion = await prevContract.getInitializedVersion()
  const nextInitializedVersion = curInitializedVersion + 1

  console.log('')
  console.log('Old [%s] Proxy addr   :', oldMainContractName, mainContract.address)
  console.log('Old [%s] Proxy addr     :', oldToken20ContractName, kmcToken.address)
  console.log('Old [%s] Proxy addr :', oldToken1155ContractName, token1155.address)
  console.log('Old InitializedVersion :', curInitializedVersion)
  console.log('Old contract version   :', await prevContract.getVersion())
  console.log('New contract version   :', newVersion)
  console.log('New contract name      :', newContractName)
  console.log('Is token1155 ?          ', isToken1155)
  console.log('')

  let prompt = new Confirm('Please confirm above info are exactly correct ?')
  let confirmation = await prompt.run()
  if (!confirmation) {
    console.log('You aborted the procedure !!')
    return false
  }

  const interval = 5 //seconds
  if (isToken1155) {
    let owner1155 = await token1155.owner()
    console.log('Old 1155Owner :', owner1155)
    console.log('main contract :', mainContract.address)
    console.log('Old 1155Owner === mainContract  :', owner1155 === mainContract.address)
    console.log('Old 1155Owner === deployer.addr :', owner1155 === deployer.address)

    let mainOwner = await mainContract.owner()
    console.log('main owner    :', mainOwner)
    console.log('the deployer  :', deployer.address)
    console.log('main owner === deployer.addr :', mainOwner === deployer.address)
    expect(mainOwner).to.equal(deployer.address)

    if (owner1155 === mainContract.address) {
      console.log('start to transfer 1155 owner to deployer ...')
      await mainContract.transfer1155OwnerToDeployer() //Set 1155's owner back to the deployer
      console.log('wait for transfer 1155 owner to deployer ...')
      for ( let i = 0; i < 20; i++) {
        await justWait(interval)
        owner1155 = await token1155.owner()
        let transSucceed = owner1155 === deployer.address
        console.log('%ds: Old 1155Owner === deployer.addr :%s', (i+1)*interval, transSucceed)
        if (transSucceed)
          break
      }
    }

    console.log('new 1155Owner :', owner1155)
    expect(mainOwner).to.equal(owner1155)

  } else {
    const oldOwner = await prevContract.owner()
    console.log('Old owner    :', oldOwner)
    console.log('The deployer :', deployer.address)
    expect(oldOwner).to.equals(deployer.address) //make sure the owner is same account
  }

  let prevContractProxyAddr = prevContract.address
  console.log('prevContractProxy :', prevContractProxyAddr)
  console.log('')

  const NewFactory = await hre.ethers.getContractFactory(newContractName, deployer) //specify the deployer, which is the contract owner
  //UpgradeProxyOptions = UpgradeOptions & { call?: { fn: string; args?: unknown[] } | string; };
  let opts = { call: { fn: 'reinitialize', args: [newVersion, nextInitializedVersion] } }
  console.log('opt:', opts)
  const newContractProxy = await hre.upgrades.upgradeProxy(prevContractProxyAddr, NewFactory, opts)

  if (isToken1155) {
    await token1155.transferOwnership(mainContract.address)
    console.log('wait for transfer 1155 owner to mainContract ...')
    let owner1155
    for ( let i = 0; i < 20; i++) {
      await justWait(interval)
      owner1155 = await token1155.owner()
      let transSucceed = owner1155 === mainContract.address
      console.log('%ds: Old 1155Owner === mainContract :%s', (i+1)*interval, transSucceed)
      if (transSucceed)
        break
    }

    expect(owner1155).to.equal(mainContract.address)
    console.log('Return 1155 ownership to mainContract')
  }

  console.log('\n\nNew proxy addr:', newContractProxy.address)
  const curVer = await newContractProxy.getVersion()
  console.log('cur contract version:', curVer)
  expect(newContractProxy.address).to.equals(prevContractProxyAddr)
  expect(curVer).to.equals(newVersion)

  console.log('')
  console.log('Upgraded [%s] to network[%s], chainId[%d] succeed !!!', newContractName, hre.network.name, await newContractProxy.signer.getChainId())

  return true
}

/**
 * This task using proxy to deploy Main contract, KmcToken, Token1155 contracts  network for the first time.
 */
task('deploy-all-proxy', 'Deploys new instance of Main contract,Token20,Token1155 to network by Proxy')
  .setAction(async (_, hre) => {
    console.log('')
    console.log('----------------------------------------------------------------------------')
    console.log('Deploying all contracts to network --- [%s] by Proxy, sure?', hre.network.name)
    console.log('----------------------------------------------------------------------------')
    console.log('Only used for deploying FIRST TIME !!! If you want to upgrade the contract, please choose upgrade task.')
    console.log('')

    const info = 'Please confirm to deploy to network [ ' + hre.network.name + ' ] ??'
    let prompt = new Confirm(info)
    let confirmation = await prompt.run()

    if (!confirmation) {
      console.log('You aborted the procedure !!')
      return
    }

    const [deployer] = await hre.ethers.getSigners()

    console.log('Deploying contracts with the account:', deployer.address)
    console.log('Deployer native token balance:', (await deployer.getBalance()).toString())

    const {mainContract, kmcToken, accounts, chainId} = await deployAllByProxy(true, hre)

    const supply = await kmcToken.totalSupply()
    console.log('total Supply:', supply)
    console.log('')
    console.log('---------------------------------------------------------------------')
    //If we deploy contracts to online network(like main net or test net), keep all initSupply kmc in deployer account, so input 'y'.
    //If we deploy to localhost for task test, need to transfer some kmc to mainContract.addr for withdraw task, so input 'n'.
    prompt = new Confirm('Keep initSupply Kmc in deployer ? (for local test, choose \'n\', for test or main net, choose \'y\')')
    confirmation = await prompt.run()
    if (!confirmation) {
      console.log('Start to transfer half of kmc to mainContract from deployer ..')
      await kmcToken.transfer(mainContract.address, supply.div(2))
      console.log('Some Kmc to deployer transferred ')
    }

    const mainContractName = getDeployedMainContractName()
    console.log('')
    console.log('[%s] deployed; Addr :', mainContractName, mainContract.address)
    console.log('KMC in [%s] :', mainContractName, hre.ethers.utils.formatEther(await kmcToken.balanceOf(mainContract.address)))
    console.log('KMC in [deployer]   :', hre.ethers.utils.formatEther(await kmcToken.balanceOf(deployer.address)))
    console.log('Deployed [%s], [%s], [%s] to network[%s], chainId[%d] succeed ...',
      mainContractName, getDeployedToken20Name(), getDeployedToken1155Name(), hre.network.name, chainId)
    console.log('')
    console.log('--------------------------------------------------------------------------------')
    console.log('Set this address in hardhat.config.js\'s networks section to use the other tasks !!!')
    console.log('--------------------------------------------------------------------------------\n')

  })

/**
 * This task is used to deploy Main,Token20,Token1155 contracts to test or formal network for the first time.
 * eg: npx hardhat upgrade-contract --new-contract-name KmcToken --new-contract-version 2      --network localhost
 * eg: npx hardhat upgrade-contract --new-contract-name ElzToken1155 --new-contract-version 2  --network localhost
 * eg: npx hardhat upgrade-contract --new-contract-name Everlazaar --new-contract-version 2    --network localhost
 */
task('upgrade-contract', 'Upgrades a specified contract to network')
  .addParam('newContractName', 'The name of the new contract ')
  .addParam('newContractVersion', 'The version of the new contract ' +
    '\neg: npx hardhat upgrade-contract --new-contract-name ElzToken1155 --new-contract-version 2  --network localhost')
  .setAction(async ({newContractName, newContractVersion}, hre) => {
    console.log('Upgrading contract[%s] to network [%s]', newContractName, hre.network.name)

    if (newContractName === '' || newContractVersion === '') {
      console.log('new Contract name or version incorrect:', newContractName, newContractVersion)
      return
    }

    if (!await upgradeContract(hre, newContractName, newContractVersion)) {
      console.log('Upgrading contract failed !!!')
      return
    }
    console.log('\nUpgrading contract succeed !!\n')

    const {mainContract, kmcToken, token1155} = await getDeployedContracts(hre)
    console.log('\n--------------------------------------------------------')
    console.log('KmcToken  version :', await kmcToken.getVersion())
    console.log('Token1155 version :', await token1155.getVersion())
    console.log('Main      version :', await mainContract.getVersion())
  })

/**
 * This task using proxy to deploy a kmc contract.
 */
task('deploy-kmc', 'Deploys new instance of kmc contract')
  .setAction(async (_, hre) => {
    console.log('')
    console.log('----------------------------------------------------------------------------')
    console.log('Deploying kmc contract to network --- [%s] by Proxy, sure?', hre.network.name)
    console.log('----------------------------------------------------------------------------')
    console.log('')

    console.log(
      'Deployment parameters:\n',
      '  initKmcSupply :', deploymentParams.INITIAL_KMC_SUPLY, '\n'
    )

    const info = 'Please confirm to deploy to network [ ' + hre.network.name + ' ] ??'
    let prompt = new Confirm(info)
    let confirmation = await prompt.run()

    if (!confirmation) {
      console.log('You aborted the procedure !!')
      return
    }
    await hre.run('compile')

    const [deployer] = await hre.ethers.getSigners()

    console.log('Deploying contracts with the account:', deployer.address)
    console.log('Deployer native token balance:', (await deployer.getBalance()).toString())

    const supply = hre.ethers.utils.parseEther(deploymentParams.INITIAL_KMC_SUPLY)

    const contractName = initToken20ContractName
    console.log('Start to deploy [%s]:', contractName)
    const factory = await hre.ethers.getContractFactory(contractName, deployer) //specify the deployer, which is the contract owner
    const contract = await hre.upgrades.deployProxy(factory, [supply], {initializer: 'initialize'})
    await contract.deployed()

    console.log('[%s] Proxy address:', contractName, contract.address)

    console.log('---------------------------------------------------------------------')
    const supply2 = await contract.totalSupply()
    console.log('total Supply:', supply2)

    console.log('-----------------------------------------------------------------------')
  })

/**
 * This task using proxy to deploy a token1155 contract.
 */
task('deploy-1155', 'Deploys new instance of token1155 contract')
  .setAction(async (_, hre) => {
    console.log('')
    console.log('----------------------------------------------------------------------------')
    console.log('Deploying token1155 contract to network --- [%s] by Proxy, sure?', hre.network.name)
    console.log('----------------------------------------------------------------------------')
    console.log('')

    const info = 'Please confirm to deploy to network [ ' + hre.network.name + ' ] ??'
    let prompt = new Confirm(info)
    let confirmation = await prompt.run()

    if (!confirmation) {
      console.log('You aborted the procedure !!')
      return
    }
    await hre.run('compile')

    const [deployer] = await hre.ethers.getSigners()

    console.log('Deploying contracts with the account:', deployer.address)
    console.log('Deployer native token balance:', (await deployer.getBalance()).toString())

    const contractName = initToken1155ContractName
    console.log('Start to deploy [%s]:', contractName)
    const factory = await hre.ethers.getContractFactory(contractName, deployer) //specify the deployer, which is the contract owner
    const contract = await hre.upgrades.deployProxy(factory, [''])
    await contract.deployed()

    console.log('[%s] Proxy address:', contractName, contract.address)
    console.log('--------------------------------------------------------------------------------')
  })

/**
 * This task using proxy to deploy a main contract Everlazaar.
 */
task('deploy-main', 'Deploys new instance of Main Everlazaar contract')
  .addParam('erc20Addr', 'The address of Erc20 deployed before')
  .addParam('erc1155Addr', 'The address of Erc1155 deployed before')
  .setAction(async ({erc20Addr, erc1155Addr}, hre) => {
    console.log('')
    console.log('----------------------------------------------------------------------------')
    console.log('Deploying Main Everlazaar contract to network --- [%s] by Proxy, sure?', hre.network.name)
    console.log('----------------------------------------------------------------------------')
    console.log('')
    console.log(
      'Deployment parameters:\n',
      '  articleDeposit:', deploymentParams.ARTICLE_DEPOSIT, '\n',
      '  mintDeposit   :', deploymentParams.MINT_DEPOSIT, '\n',
      '  initKmcSupply :', deploymentParams.INITIAL_KMC_SUPLY, '\n'
    )
    console.log('Erc20Addr   :', erc20Addr)
    console.log('Erc1155Addr :', erc1155Addr)

    await hre.run('compile')

    const info = 'Please confirm to deploy to network [ ' + hre.network.name + ' ] ??'
    let prompt = new Confirm(info)
    let confirmation = await prompt.run()

    if (!confirmation) {
      console.log('You aborted the procedure !!')
      return
    }

    const [deployer] = await hre.ethers.getSigners()

    console.log('Deploying contracts with the account:', deployer.address)
    console.log('Deployer native token balance:', (await deployer.getBalance()).toString())

    const contractName = initMainContractName
    console.log('Start to deploy [%s]:', contractName)
    const mainFactory = await  hre.ethers.getContractFactory(contractName, deployer)//specify the deployer, which is the contract owner
    const mainContract = await  hre.upgrades.deployProxy(mainFactory, [
      erc20Addr,
      erc1155Addr,
      deploymentParams.ARTICLE_DEPOSIT,
      deploymentParams.MINT_DEPOSIT,
    ])

    await mainContract.deployed()

    console.log('[%s] Proxy address:', contractName, mainContract.address)

    //transfer token1155's ownership, from deployer to main contract
    const token1155 = await hre.ethers.getContractAt(initToken1155ContractName, erc1155Addr)
    await token1155.transferOwnership(mainContract.address)
    console.log('Transferred token1155 ownership to [%s]', contractName)

    console.log('--------------------------------------------------------------------------------')
    console.log('Set this address in hardhat.config.js\'s networks section to use the other tasks !!!')
    console.log('--------------------------------------------------------------------------------\n')
    console.log('')
  })

