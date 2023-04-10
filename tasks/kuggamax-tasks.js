const {sha256, randomBytes} = require("ethers/lib/utils")
const {expect} = require("chai")
const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {task} = require("hardhat/config");

const {
  getDeployedKuggamax,
  hasEnoughTokens,
  hasEnoughAllowance,
  giveAllowance,
  buildDomain,
  permitApproveKmc,
  getRandItemHash,
  deployAllByProxy,
} = require('../scripts/utils')

const deploymentParams = require("./deployment-params")


/**
 * This task is used to test tasks, so half of initial KMCs are kept by deployer account for subsequent test task.
 */
task('deploy-for-task', 'Deploys a new instance of kuggamax for tasks')
  .setAction(async (_, hre) => {

    console.log('Deploying contracts for tasks:')
    const [admin] = await hre.ethers.getSigners()

    console.log("Deploying contracts with the account:", admin.address)
    console.log("Deployer native token balance:", (await admin.getBalance()).toString())

    const {kuggamax, kmcToken, token1155} = await deployAllByProxy(false, hre)

    const supply = await kmcToken.totalSupply()
    console.log('supply:', supply)
    await kmcToken.transfer(kuggamax.address, supply.div(2))

    console.log('')
    console.log('Kuggamax deployed. Address:', kuggamax.address)
    console.log('KMC in Kuggamax:', hre.ethers.utils.formatEther(await kmcToken.balanceOf(kuggamax.address)))
    console.log('Deployed Kuggamax for tasks succeed !!!')

  })

task('create-lab', 'Creates a new lab')
  .addParam('title', 'The lab title')
  .setAction(async ({ title }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.LAB_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.LAB_DEPOSIT)) {
      await giveAllowance(kmcToken, sender, kuggamax, deploymentParams.LAB_DEPOSIT)
    }

    const labAssocId = Number(await kuggamax.getLabCount()) + 10
    console.log('labAssocId:', labAssocId)

    const description = 'Description of lab ' + title
    await kuggamax.createLab(labAssocId, title, description)

    console.log('Lab created')
  })

task('create-item', 'Creates a new item')
  .addParam('lab', 'The ID of the lab')
  .addParam('hash', 'The Hash value of the item', undefined, types.Bytes, true)
  .setAction(async ({ lab, hash }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    if (!hash) {
      hash = sha256(randomBytes(32))
    }

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.ITEM_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.ITEM_DEPOSIT)) {
      await giveAllowance(kmcToken, sender, kuggamax, deploymentParams.ITEM_DEPOSIT)
    }

    await kuggamax.createItem(lab, hash)

    console.log('Item created')
  })


task('mint', 'Mint an ERC1155 token for the item')
  .addParam('item', 'The ID of the item')
  .addParam('amount', 'The amount of the token', 100, types.int)
  .setAction(async ({ item, amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.MINT_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.MINT_DEPOSIT)) {
      await giveAllowance(kmcToken, sender, kuggamax, deploymentParams.MINT_DEPOSIT)
    }

    await kuggamax.mint(item, amount)

    console.log('Item minted')
  })

task('add-member', 'Adds a member to the specified lab')
  .addParam('lab', "The lab id")
  .addParam('member', "The member's address")
  .setAction(async ({ lab,member }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    await kuggamax.addMembers(lab,[member])
    console.log('Member added')
  })

task('remove-member', 'Removes a member from the specified lab')
 .addParam('lab', "The lab id")
  .addParam('member', "The member's address")
  .setAction(async ({lab, member }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    await kuggamax.removeMembers(lab,[member])
    console.log('Member removed')
  })

task('deposit', 'Deposit native tokens to get some KMC back')
  .addParam('amount', "The amount of native token to deposit, in ETH")
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    let depositEvent = new Promise((resolve, reject) => {
      kuggamax.on('Deposit', (sender, amount) => {

        resolve({
          sender: sender,
          amount: amount
        })
      })

      setTimeout(() => {
        reject(new Error('timeout'))
      }, 60000)
    })

    await kuggamax.deposit({ value : hre.ethers.utils.parseEther(amount) })

    let event = await depositEvent
    console.log('deposit... done!', event)

    const [sender] = await hre.ethers.getSigners()
    console.log('amount deposited, balance: ', hre.ethers.utils.formatEther(await kmcToken.balanceOf(sender.address)))
    console.log('native balance: ', hre.ethers.utils.formatEther(await sender.getBalance()))
  })


task('withdraw', 'Withdraw native tokens by transferring some KMC')
  .addParam('amount', "The amount of native token to withdraw, in KMC")
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    const kmcAmount = hre.ethers.utils.parseEther(amount)
    await kmcToken.approve(kuggamax.address, kmcAmount)
    await kuggamax.withdraw(kmcAmount)

    console.log('amount withdrawn, balance: ', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender.address))))
    console.log('native balance: ', hre.ethers.utils.formatEther(await sender.getBalance()))
  })


task('admin-withdraw', 'Administrator withdraw native tokens from Kuggamax')
  .addParam('amount', "The amount of native tokens to withdraw")
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    const ethAmount = hre.ethers.utils.parseEther(amount)
    const kmBalance = await sender.provider.getBalance(kuggamax.address)

    console.log('Kuggamax native balance1: ', kmBalance)
    const tx = {
      to: kuggamax.address,
      value: ethAmount
    }
    await sender.sendTransaction(tx)

    console.log('Kuggamax native balance : ', await sender.provider.getBalance(kuggamax.address))
    expect(await sender.provider.getBalance(kuggamax.address)).to.be.equals(kmBalance + ethAmount)

    await kuggamax.adminWithdraw(ethAmount)

    const kmBalance2 = await sender.provider.getBalance(kuggamax.address)
    console.log('Kuggamax native balance2: ', kmBalance2)
    expect(kmBalance).to.be.equal(kmBalance2)

  })

task('debug', 'Shows debug info')
  .setAction(async (_, hre) => {

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    // const guildAddress = await kuggamax.guildBank()

    const labCount = await kuggamax.getLabCount()
    const itemCount = await kuggamax.getItemCount()

    for (let i = 0; i < labCount; i++) {
      const lab = await kuggamax.getLab(i)
      console.log('lab', i, lab)
    }
    for (let i = 0; i < itemCount; i++) {
      const item = await kuggamax.getItem(i)
      console.log('item', i, item)
    }

    // console.log('_nextItemIndex', (await kuggamax._nextItemIndex()))

    const [sender, sender1] = await hre.ethers.getSigners()

    console.log("Token address:", kmcToken.address)
    console.log("Token supply:", hre.ethers.utils.formatEther(await kmcToken.totalSupply()))

    const k0 = await sender.getBalance()
    console.log('native balance of sender', hre.ethers.utils.formatEther(k0))

    const k1 = await sender.provider.getBalance(kuggamax.address)
    console.log('native balance of kuggamax', hre.ethers.utils.formatEther(k1))

    console.log('balance0 1155', (await itemToken.balanceOf(sender.address, 1)).toString())


    console.log('KMC balance0', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender.address))))
    console.log('KMC balance1', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender1.address))))
    console.log('KMC balance of Kuggamax', hre.ethers.utils.formatEther((await kmcToken.balanceOf(kuggamax.address))))
    // console.log('balance of Guild', hre.ethers.utils.formatEther((await kmcToken.balanceOf(guildAddress))))
  })



const version = "1"

task('permit-approve', 'Permits someone to execute the KMC Approve operation instead by verifying signature')
  .addParam('amount', 'The amount of KMC will be approved to spender')
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { kuggamax, kmcToken } = await getDeployedKuggamax(hre)
    expect( kmcToken !== undefined )

    const name = await kmcToken.name() //"Kuggamax Token"
    console.log('token name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0] //token20.permit() caller
    const owner = accounts[1]   //lab creator
    const chainId = await owner.getChainId()

    const maxDeadline = hre.ethers.constants.MaxUint256

    const nonce = await kmcToken.nonces(owner.address)
    console.log('nonce=', nonce)

    const spender = kuggamax.address
    console.log('spenderAddr:', spender)
    console.log('kmcAmount:', amount)
    let kmcAmount = hre.ethers.utils.parseEther(amount)
    if (kmcAmount <= 0) {
      kmcAmount = 10
    }

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const domain = buildDomain(name, version, chainId, kmcToken.address)
    const types = {
      Permit: [ //"Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        {name: 'owner', type: 'address'},
        {name: 'spender', type: 'address'},
        {name: 'value', type: 'uint256'},
        {name: 'nonce', type: 'uint256'},
        {name: 'deadline', type: 'uint256'}
      ]
    }
    const data = {
      owner: owner.address,
      spender: spender,
      value: kmcAmount,
      nonce: nonce,
      deadline: maxDeadline
    }
    // console.log('domain:', domain)
    // console.log('types:', types)
    // console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    //console.log('v, r, s:', v, r, s)

    //test method and get receipt
    const receipt = await kmcToken.connect(caller).permit(owner.address, spender, kmcAmount, maxDeadline, v, r, s)
    await receipt.wait()
    console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await kmcToken.nonces(owner.address)).to.be.equal(nonce.add(1))
    console.log('kmcAmount:', kmcAmount)
    expect(await kmcToken.allowance(owner.address, spender)).to.be.equal(kmcAmount)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-approve PASSED !!!!')
  })


task('permit-create-lab', 'Permits someone to execute new lab creation operation instead by verifying signature')
  .addParam('title', 'The lab title')
  .setAction(async ({ title }, hre) => {
    await hre.run('compile')

    const { kuggamax, kmcToken } = await getDeployedKuggamax(hre)
    expect( kuggamax !== undefined )
    expect( kmcToken !== undefined )

    const name = "Kuggamax" //await kuggamax.name()
    console.log('contract name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0]
    const owner = accounts[1]
    const chainId = await owner.getChainId()

    //if owner has no enough allowance for create lab, approve it by permit
    const deposit = deploymentParams.LAB_DEPOSIT
    if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
      console.log('has not enough allowance')
      await permitApproveKmc(kmcToken, owner, kuggamax, deposit, hre)
    }
    //Just for test!!! if owner has enough kmc balance for create lab, transfer it from accounts[0]
    if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
      console.log('transfer to owner:', deposit)
      await kmcToken.connect(caller).transfer(owner.address, deposit)
    }

    const nonce = await kuggamax.nonces(owner.address)
    console.log('nonce=', nonce)

    console.log('param:', title)

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const domain = buildDomain(name, version, chainId, kuggamax.address)
    const types = {
      PermitCreateLab: [  //PermitCreateLab(string title,string description,address owner,uint256 nonce)
        {name: 'title', type: 'string'},
        {name: 'description', type: 'string'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }
    const desc = 'Description of Lab ' + title
    const data = {
      title: title,
      description: desc,
      owner: owner.address,
      nonce: nonce,
    }
    // console.log('domain:', domain)
    // console.log('types:', types)
    // console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    console.log('v, r, s:', v, r, s)

    //test method and Event with argument
    const labAssocId = Number(await kuggamax.getLabCount()) + 10
    console.log('labAssocId:', labAssocId)
    const newLabId = await kuggamax.getLabCount()
    console.log('newLabId:', newLabId)
    await expect(kuggamax.connect(caller).permitCreateLab(labAssocId, title, desc, owner.address, v, r, s))
      .to.emit(kuggamax, "LabCreated").withArgs(newLabId, labAssocId)

    // //test method and get receipt
    // const receipt = await kuggamax.connect(caller).permitCreateLab(description, owner.address, v, r, s))
    // await receipt.wait()
    // console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await kuggamax.nonces(owner.address)).to.be.equal(nonce.add(1))
    const ownerKmc = balanceOfOwner.sub(deploymentParams.LAB_DEPOSIT)
    console.log('owner KMC:', ownerKmc)
    //expect(await kmcToken.balanceOf(owner.address)).to.be.equal(ownerKmc)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('native owner balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-create-lab PASSED !!!!')
  })


task('permit-create-item', 'Permits someone to execute new item creation operation instead by verifying signature')
  .addParam('labid', 'The lab Id which the item will be created')
  .setAction(async ({ labid }, hre) => {
    await hre.run('compile')

    const { kuggamax, kmcToken } = await getDeployedKuggamax(hre)
    expect( kuggamax !== undefined )
    expect( kmcToken !== undefined )

    const name = "Kuggamax" //await kuggamax.name()
    console.log('contract name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0]
    const owner = accounts[1]
    const chainId = await owner.getChainId()

    //if owner has no enough allowance for create item, approve it by permit
    const deposit = deploymentParams.ITEM_DEPOSIT
    if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
      await permitApproveKmc(kmcToken, owner, kuggamax, deposit, hre)
    }
    //Just for test!!! if owner has enough kmc balance for create item, transfer it from accounts[0]
    if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
      await kmcToken.connect(caller).transfer(owner.address, deposit)
    }

    const nonce = await kuggamax.nonces(owner.address)
    console.log('nonce=', nonce)

    console.log('param:', labid)

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const labId = Number(labid)
    const itemHash = getRandItemHash(labId)
    console.log('labId:', labId)
    console.log('itemHash:', itemHash, typeof(itemHash))

    const domain = buildDomain(name, version, chainId, kuggamax.address)
    const types = {
      PermitCreateItem: [  //PermitCreateItem(uint64 labId,bytes32 hash,address owner,uint256 nonce)
        {name: 'labId', type: 'uint64'},
        {name: 'hash', type: 'bytes32'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }
    const data = {
      labId: labId,
      hash: itemHash,
      owner: owner.address,
      nonce: nonce,
    }
    // console.log('domain:', domain)
    // console.log('types:', types)
    // console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    // console.log('v, r, s:', v, r, s)

    console.log('Lab count:', await kuggamax.getLabCount())
    //test method and Event with argument
    const newItemId = await kuggamax.getItemCount()
    console.log('newItemId:', newItemId)
    await expect(kuggamax.connect(caller).permitCreateItem(labId, itemHash, owner.address, v, r, s))
      .to.emit(kuggamax, "ItemCreated")
      .withArgs(owner.address, labId, newItemId, anyValue)


    // //test method and get receipt
    // const receipt = await kuggamax.connect(caller).permitCreateItem(labId, itemHash, owner.address, v, r, s))
    // await receipt.wait()
    // console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await kuggamax.nonces(owner.address)).to.be.equal(nonce.add(1))
    const ownerKmc = balanceOfOwner.sub(deploymentParams.ITEM_DEPOSIT)
    console.log('owner KMC:', ownerKmc)
    //expect(await kmcToken.balanceOf(owner.address)).to.be.equal(ownerKmc)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('native owner balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-create-item PASSED !!!!')
  })



task('permit-mint', 'Permits someone to execute item mint operation instead by verifying signature')
  .addParam('itemid', 'The item Id will be minted')
  .addParam('amount', 'The amount of item will be minted')
  .setAction(async ({ itemid, amount }, hre) => {
    await hre.run('compile')

    const { kuggamax, kmcToken } = await getDeployedKuggamax(hre)
    expect( kuggamax !== undefined )
    expect( kmcToken !== undefined )

    const name = "Kuggamax" //await kuggamax.name()
    console.log('contract name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0]
    const owner = accounts[1]
    const chainId = await owner.getChainId()

    //if owner has no enough allowance for mint, approve it by permit
    const deposit = deploymentParams.MINT_DEPOSIT
    if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
      await permitApproveKmc(kmcToken, owner, kuggamax, deposit, hre)
    }
    //Just for test!!! if owner has enough kmc balance for mint, transfer it from accounts[0]
    if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
      await kmcToken.connect(caller).transfer(owner.address, deposit)
    }

    const nonce = await kuggamax.nonces(owner.address)
    console.log('nonce=', nonce)

    console.log('param:', itemid, amount)

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const itemId = Number(itemid)
    const itemAmount = Number(amount)
    console.log('itemId:', itemId)
    console.log('itemAmount:', itemAmount)

    const domain = buildDomain(name, version, chainId, kuggamax.address)
    const types = {
      PermitMint: [  //PermitMint(uint64 itemId,uint256 amount,address owner,uint256 nonce)
        {name: 'itemId', type: 'uint64'},
        {name: 'amount', type: 'uint256'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }
    const data = {
      owner: owner.address,
      itemId: itemId,
      amount: itemAmount,
      nonce: nonce,
    }
    // console.log('domain:', domain)
    // console.log('types:', types)
    console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    console.log('v, r, s:', v, r, s)

    //test method and Event with argument
    await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
      .to.emit(kuggamax, "ItemMinted")
      .withArgs(owner.address, itemId, itemAmount)


    // //test method and get receipt
    // const receipt = await kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
    // await receipt.wait()
    // console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await kuggamax.nonces(owner.address)).to.be.equal(nonce.add(1))
    const ownerKmc = balanceOfOwner.sub(deploymentParams.MINT_DEPOSIT)
    console.log('owner KMC:', ownerKmc)
    //expect(await kmcToken.balanceOf(owner.address)).to.be.equal(ownerKmc)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('native owner balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-mint PASSED !!!!')
  })