
// These functions are meant to be run from tasks, so the
// RuntimeEnvironment is available in the global scope.

const {randomBytes, sha256} = require('ethers/lib/utils');
const {expect} = require('chai');
const deploymentParams = require('../tasks/deployment-params');
const Confirm = require('prompt-confirm');

const initMainContractName = 'Everlazaar'
const initToken20ContractName = 'KmcToken'
const initToken1155ContractName = 'ElzToken1155'

let deployedMainContractName = initMainContractName
let deployedToken20ContractName = initToken20ContractName
let deployedToken1155ContractName = initToken1155ContractName

/**
 * Returns the address of the MainContract as set in the config, or undefined if
 * it hasn't been set.
 */
function getMainContractAddress (hre) {
  return hre.config.networks[hre.network.name].deployedContracts.mainContract
}

/**
 * Returns the deployed instance of the MainContract, or undefined if its
 * address hasn't been set in the config.
 */
async function getDeployedContracts (hre) {
  const mainContractAddress = getMainContractAddress(hre)
  if (!mainContractAddress) {
    console.error(`Please, set the [%s] address in config`, deployedMainContractName)
    return
  }
  if (deployedMainContractName === undefined) {
    deployedMainContractName = initMainContractName
    console.log('set default main contract name:', deployedMainContractName)
  }
  if (deployedToken20ContractName === undefined) {
    deployedToken20ContractName = initToken20ContractName
    console.log('set default token20 name:', deployedToken20ContractName)
  }
  if (deployedToken1155ContractName === undefined) {
    deployedToken1155ContractName = initToken1155ContractName
    console.log('set default name token1155:', deployedToken1155ContractName)
  }
  console.log('Deployed mainContract name:', deployedMainContractName)
  console.log('Deployed Token20 name:', deployedToken20ContractName)
  console.log('Deployed Token1155 name:', deployedToken1155ContractName)

  const mainContract = await hre.ethers.getContractAt(deployedMainContractName, mainContractAddress)
  const erc20Address = await mainContract.kmc()

  const kmcToken = await hre.ethers.getContractAt(deployedToken20ContractName, erc20Address)
  const erc1155Address = await mainContract.token1155()
  const token1155 = await hre.ethers.getContractAt(deployedToken1155ContractName, erc1155Address)
  return { mainContract, kmcToken, token1155 }
}


async function giveAllowance (tokenContract, allowanceGiver, receiverContract, amount) {
  //return tokenContract.approve(receiverContract.address, amount, { from: allowanceGiver })
  return tokenContract.connect(allowanceGiver).approve(receiverContract.address, amount)
}

async function hasEnoughAllowance (tokenContract, allowanceGiver, receiverContract, amount) {
  const allowance = await tokenContract.allowance(allowanceGiver, receiverContract.address)
  return allowance.gte(amount)
}

async function hasEnoughTokens (tokenContract, tokensOwner, amount) {
  const balance = await tokenContract.balanceOf(tokensOwner)
  return balance.gte(amount)
}

function buildDomain(name, version, chainId, verifyingContract) {
  return { name, version, chainId, verifyingContract }
}

const getRandContentHash = (c) => {
  const itemContent = Buffer.from(c, 'utf8')
  return sha256(itemContent)
}

//permit approve kmc to mainContract contract
const permitApproveKmc = async (kmcToken, owner, spender, amount, hre) => {
  const name = await kmcToken.name()
  const version = '1'

  const accounts = await hre.ethers.getSigners()
  const caller = accounts[0] //token20.permit() caller
  const chainId = await owner.getChainId()

  const maxDeadline = hre.ethers.constants.MaxUint256
  const nonce = await kmcToken.nonces(owner.address)

  let kmcAmount = amount

  const domain = buildDomain(name, version, chainId, kmcToken.address)
  const types = {
    Permit: [ //'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
      {name: 'value', type: 'uint256'},
      {name: 'nonce', type: 'uint256'},
      {name: 'deadline', type: 'uint256'}
    ]
  }
  const data = {
    owner: owner.address,
    spender: spender.address,
    value: kmcAmount,
    nonce: nonce,
    deadline: maxDeadline
  }

  const signature = await owner._signTypedData(domain, types, data)
  const { v, r, s } = hre.ethers.utils.splitSignature(signature)
  await kmcToken.connect(caller).permit(owner.address, spender.address, kmcAmount, maxDeadline, v, r, s)

  expect(await kmcToken.allowance(owner.address, spender.address)).to.be.equal(kmcAmount)
}


function getDeployedMainContractName () {
  return deployedMainContractName
}
function getDeployedToken20Name () {
  return deployedToken20ContractName
}
function getDeployedToken1155Name () {
  return deployedToken1155ContractName
}

function setDeployedMainContractName (name) {
  deployedMainContractName = name
}
function setDeployedToken20Name (name) {
  deployedToken20ContractName = name
}
function setDeployedToken1155Name (name) {
  deployedToken1155ContractName = name
}

/*
 * Deploy MainContract, Kmc, Token1155 contract by Proxy to support upgrade.
 */
const deployAllByProxy = async (needConfirm, hre) => {
  console.log('------------------------------------------------------')
  console.log('Deploying [%s], [%s], [%s] by Proxy:', deployedMainContractName, deployedToken20ContractName, deployedToken1155ContractName)
  console.log(
    'Deployment parameters:\n',
    '  articleDeposit:', deploymentParams.ARTICLE_DEPOSIT, '\n',
    '  mintDeposit   :', deploymentParams.MINT_DEPOSIT, '\n',
    '  initKmcSupply :', deploymentParams.INITIAL_KMC_SUPLY, '\n'
  )


  await hre.run('compile')

  const supply = hre.ethers.utils.parseEther(deploymentParams.INITIAL_KMC_SUPLY)

  console.log('')
  console.log('-------------------------------------------------------------')
  if (needConfirm === true) {
    const prompt = new Confirm('Please confirm that the deployment parameters are correct')
    const confirmation = await prompt.run()

    if (!confirmation) {
      console.log('You aborted the procedure !! Please check the Deployment Parameters !!')
      return
    }
  }

  const accounts = await  hre.ethers.getSigners()
  const deployer = accounts[0] //specify the deployer, which is the contract owner
  console.log('account0 addr :', accounts[0].address)
  if (accounts.length > 1) {
    console.log('account1 addr :', accounts[1].address)
  }
  console.log('deployer addr :', deployer.address)

  console.log('')
  //KmcToken
  console.log('Start to deploy [%s]:', deployedToken20ContractName)
  const kmcFactory = await hre.ethers.getContractFactory(deployedToken20ContractName, deployer) //specify the deployer, which is the contract owner
  const kmcToken = await hre.upgrades.deployProxy(kmcFactory, [supply], {initializer: 'initialize'})
  await kmcToken.deployed()

  console.log('[%s] Proxy address:', deployedToken20ContractName, kmcToken.address)
  console.log('[%s] supply:', deployedToken20ContractName, await kmcToken.totalSupply())
  console.log('')


  //Token1155
  console.log('Start to deploy [%s]:', deployedToken1155ContractName)
  const Token1155 = await hre.ethers.getContractFactory(deployedToken1155ContractName, deployer)
  const token1155 = await hre.upgrades.deployProxy(Token1155, [''])
  await token1155.deployed()

  console.log('[%s] Proxy address:', deployedToken1155ContractName, token1155.address)
  console.log('')

  //Main contract
  console.log('Start to deploy [%s]:', deployedMainContractName)
  const mainFactory = await  hre.ethers.getContractFactory(deployedMainContractName, deployer)//specify the deployer, which is the contract owner
  const mainContract = await  hre.upgrades.deployProxy(mainFactory, [
    kmcToken.address,
    token1155.address,
    deploymentParams.ARTICLE_DEPOSIT,
    deploymentParams.MINT_DEPOSIT,
  ])

  await mainContract.deployed()

  console.log('[%s] Proxy Address:', deployedMainContractName, mainContract.address)
  console.log('KMC in [%s]:', deployedMainContractName, hre.ethers.utils.formatEther(await kmcToken.balanceOf(mainContract.address)))
  console.log('')

  console.log('deployer kmc balance:', await kmcToken.balanceOf(deployer.address))
  expect(await kmcToken.balanceOf(deployer.address)).to.equals(supply)

  console.log('deployer native balance:', hre.ethers.utils.formatEther(await deployer.getBalance()))

  const chainId = await deployer.getChainId()

  //transfer token1155's ownership, from deployer to main contract
  await token1155.transferOwnership(mainContract.address)
  console.log('Transfer token1155 ownership to [%s], wait for result', deployedMainContractName)
  for (let i = 0; i < 15; i++) {
    let ow = await token1155.owner()
    console.log('get 1155 owner addr:', ow);
    if (await ow === mainContract.address) {
      console.log('1155 owner addr === mainContract.addr')
      break
    }
    setTimeout(() => {
    }, 3000);
  }

  return { mainContract, kmcToken, token1155, accounts, chainId }

}

//function justWait (sec) {
const justWait = async (sec) => {
  console.log('start to wait for [%d] seconds ...', sec)

  let w = new Promise((resolve, reject) => {

    setTimeout(() => {
      resolve('waiting for [' + sec + '] seconds end ...')
    }, sec * 1000)
  })

  let res = await w
  console.log('end justWait, ', res)
}


module.exports = {
  deployAllByProxy,
  getDeployedContracts,
  giveAllowance,
  hasEnoughAllowance,
  hasEnoughTokens,
  buildDomain,
  getRandContentHash,
  permitApproveKmc,
  getDeployedMainContractName,
  getDeployedToken20Name,
  getDeployedToken1155Name,
  setDeployedMainContractName,
  setDeployedToken20Name,
  setDeployedToken1155Name,
  justWait,
}
