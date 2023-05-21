const {sha256, randomBytes} = require('ethers/lib/utils')
const {expect} = require('chai')
const {anyValue} = require('@nomicfoundation/hardhat-chai-matchers/withArgs');
const {task} = require('hardhat/config');

const {
  getDeployedContracts,
  hasEnoughTokens,
  hasEnoughAllowance,
  giveAllowance,
  buildDomain,
  permitApproveKmc,
  getRandContentHash,
  deployAllByProxy,
  getDeployedMainContractName,
} = require('../scripts/utils')

const deploymentParams = require('./deployment-params')
const Confirm = require('prompt-confirm');


/**
 * Note:
 * For task test, run 'npx hardhat deploy-all-proxy' first to deploy, and choose 'n' when 'Keep initSupply Kmc in admin ?' is asked.
 */


// task('create-article', 'Creates a new article')
//   .addParam('hash', 'The Hash value of the article', undefined, types.Bytes, true)
//   .setAction(async ({ hash }, hre) => {
//     // Make sure everything is compiled
//     await hre.run('compile')
//
//     const { mainContract, kmcToken } = await getDeployedContracts(hre)
//     if (mainContract === undefined || kmcToken === undefined) {
//       return
//     }
//
//     const [sender] = await hre.ethers.getSigners()
//
//     if (!hash) {
//       hash = sha256(randomBytes(32))
//     }
//
//     if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.ARTICLE_DEPOSIT)) {
//       console.error('You don't have enough KMC tokens')
//       return
//     }
//
//     if (!await hasEnoughAllowance(kmcToken, sender.address, mainContract, deploymentParams.ARTICLE_DEPOSIT)) {
//       await giveAllowance(kmcToken, sender, mainContract, deploymentParams.ARTICLE_DEPOSIT)
//     }
//
//     await mainContract.createArticle(hash)
//
//     console.log('Article created')
//   })

// task('mint', 'Mint an ERC1155 token for the article')
//   .addParam('article', 'The ID of the article')
//   .addParam('amount', 'The amount of the token', 100, types.int)
//   .setAction(async ({ article, amount }, hre) => {
//     // Make sure everything is compiled
//     await hre.run('compile')
//
//     const { mainContract, kmcToken } = await getDeployedContracts(hre)
//     if (mainContract === undefined || kmcToken === undefined) {
//       return
//     }
//
//     const [sender] = await hre.ethers.getSigners()
//
//     if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.MINT_DEPOSIT)) {
//       console.error('You don't have enough KMC tokens')
//       return
//     }
//
//     if (!await hasEnoughAllowance(kmcToken, sender.address, mainContract, deploymentParams.MINT_DEPOSIT)) {
//       await giveAllowance(kmcToken, sender, mainContract, deploymentParams.MINT_DEPOSIT)
//     }
//
//     await mainContract.mint(article, amount)
//
//     console.log('Article minted')
//   })

task('deposit', 'Deposit native tokens to get some KMC back')
  .addParam('amount', 'The amount of native token to deposit, in ETH')
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { mainContract, kmcToken } = await getDeployedContracts(hre)
    if (mainContract === undefined || kmcToken === undefined) {
      return
    }

    let depositEvent = new Promise((resolve, reject) => {
      mainContract.on('Deposit', (sender, amount) => {

        resolve({
          sender: sender,
          amount: amount
        })
      })

      setTimeout(() => {
        reject(new Error('timeout'))
      }, 60000)
    })

    const [sender] = await hre.ethers.getSigners()
    console.log('native balance: ', hre.ethers.utils.formatEther(await sender.getBalance()))
    console.log('Before deposit,  main kmc balance: ', hre.ethers.utils.formatEther(await kmcToken.balanceOf(sender.address)))

    await mainContract.deposit({ value : hre.ethers.utils.parseEther(amount) })

    console.log('After deposited, main kmc balance: ', hre.ethers.utils.formatEther(await kmcToken.balanceOf(sender.address)))
    console.log('native balance: ', hre.ethers.utils.formatEther(await sender.getBalance()))

    let event = await depositEvent
    console.log('deposit... done!', event)
  })

task('withdraw', 'Withdraw native tokens by transferring some KMC')
  .addParam('amount', 'The amount of native token to withdraw, in KMC')
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { mainContract, kmcToken } = await getDeployedContracts(hre)
    if (mainContract === undefined || kmcToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()
    console.log('native balance: ', hre.ethers.utils.formatEther(await sender.getBalance()))
    console.log('Before withdrawn, kmc balance: ', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender.address))))

    const kmcAmount = hre.ethers.utils.parseEther(amount)
    await kmcToken.approve(mainContract.address, kmcAmount)
    await mainContract.withdraw(kmcAmount)

    console.log('After withdrawn,  kmc balance: ', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender.address))))
    console.log('native balance:  ', hre.ethers.utils.formatEther(await sender.getBalance()))
  })


task('admin-withdraw', 'Administrator withdraw native tokens from Main contract')
  .addParam('amount', 'The amount of native tokens to withdraw')
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { mainContract, kmcToken } = await getDeployedContracts(hre)
    if (mainContract === undefined || kmcToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    const ethAmount = hre.ethers.utils.parseEther(amount)
    const kmBalance = await sender.provider.getBalance(mainContract.address)

    console.log('mainContract native balance1: ', kmBalance)
    const tx = {
      to: mainContract.address,
      value: ethAmount
    }
    await sender.sendTransaction(tx)

    console.log('mainContract native balance : ', await sender.provider.getBalance(mainContract.address))
    expect(await sender.provider.getBalance(mainContract.address)).to.be.equals(kmBalance + ethAmount)

    await mainContract.adminWithdraw(ethAmount)

    const kmBalance2 = await sender.provider.getBalance(mainContract.address)
    console.log('mainContract native balance2: ', kmBalance2)
    expect(kmBalance).to.be.equal(kmBalance2)

  })


task('set-article-deposit', 'Administrator set value of article create deposit')
  .addParam('amount', 'The amount of native tokens to set')
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { mainContract, kmcToken } = await getDeployedContracts(hre)
    if (mainContract === undefined || kmcToken === undefined) {
      return
    }

    const [admin] = await hre.ethers.getSigners()

    const deposit = hre.ethers.utils.parseEther(amount)
    console.log('set deposit: ', deposit)
    const oldDeposit = await mainContract.articleDeposit()
    console.log('oldDeposit: ', oldDeposit)

    await mainContract.setArticleDeposit(deposit)

    const newDeposit = await mainContract.articleDeposit()
    console.log('newDeposit: ', newDeposit)

    //expect(newDeposit).to.be.equal(deposit)

  })

task('set-mint-deposit', 'Administrator set value of article mint deposit')
  .addParam('amount', 'The amount of native tokens to set')
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { mainContract, kmcToken } = await getDeployedContracts(hre)
    if (mainContract === undefined || kmcToken === undefined) {
      return
    }

    const [admin] = await hre.ethers.getSigners()

    const deposit = hre.ethers.utils.parseEther(amount)
    console.log('set deposit: ', deposit)
    const oldDeposit = await mainContract.mintDeposit()
    console.log('oldDeposit: ', oldDeposit)

    await mainContract.setMintDeposit(deposit)

    const newDeposit = await mainContract.mintDeposit()
    console.log('newDeposit: ', newDeposit)

    //expect(newDeposit).to.be.equal(deposit)

  })

task('tt', 'Shows test')
  .setAction(async (_, hre) => {
    const accounts = await hre.ethers.getSigners()
    const a0 = accounts[0]
    const a1 = accounts[1]

    console.log('a0.addr:', a0.address)
    console.log('a1.addr:', a1.address)

    const { mainContract, kmcToken, token1155 } = await getDeployedContracts(hre)
    if (mainContract === undefined || kmcToken === undefined || token1155 === undefined) {
      return
    }

  })

task('debug', 'Shows debug info')
  .setAction(async (_, hre) => {

    const { mainContract, kmcToken, token1155 } = await getDeployedContracts(hre)
    if (mainContract === undefined || kmcToken === undefined || token1155 === undefined) {
      return
    }

    let count = Number(await mainContract.getArticleCount())
    let start = count > 5 ? count - 5 : 0
    console.log('\n-------------------------------------------------------------')
    console.log('Print last 5; Article count[%d], from [%d] to [%d]', count, start, count - 1)
    //print last 5
    for (let i = start; i < count; i++) {
      const a = await mainContract.getArticle(i)
      console.log('article', i, a)
    }

    const accounts = await hre.ethers.getSigners()
    const sender = accounts[0]

    count = accounts.length > 3 ? 3 : accounts.length
    console.log('\n-------------------------------------------------------------')
    console.log('Print first 3; Accounts count:', accounts.length)
    //print first 3 account if enough
    for (let i = 0; i < count; i++) {
      console.log('accounts[%d].addr=[%s]', i, accounts[i].address)
    }

    console.log('\n-------------------------------------------------------------')
    console.log('ArticleDeposit   :', hre.ethers.utils.formatEther(await mainContract.articleDeposit()))
    console.log('MintDeposit      :', hre.ethers.utils.formatEther(await mainContract.mintDeposit()))
    console.log('Kmc total supply :', hre.ethers.utils.formatEther(await kmcToken.totalSupply()))

    const k0 = await sender.getBalance()
    const k1 = await sender.provider.getBalance(mainContract.address)
    console.log('\n-------------------------------------------------------------')
    console.log('Admin native balance :', hre.ethers.utils.formatEther(k0))
    console.log('Main  native balance :', hre.ethers.utils.formatEther(k1))

    console.log('\n-------------------------------------------------------------')
    console.log('Admin KMC balance  :', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender.address))))
    console.log('Main  KMC balance  :', hre.ethers.utils.formatEther((await kmcToken.balanceOf(mainContract.address))))
    console.log('admin 1155 balance :', (await token1155.balanceOf(sender.address, 1)).toString())

    console.log('\n-------------------------------------------------------------')
    console.log('Main Initialized version  :', await mainContract.getInitializedVersion())
    console.log('Main contract    version  :', await mainContract.getVersion())
    console.log('Kmc Initialized  version  :', await kmcToken.getInitializedVersion())
    console.log('Kmc  contract    version  :', await kmcToken.getVersion())
    console.log('1155 Initialized version  :', await token1155.getInitializedVersion())
    console.log('1155 contract    version  :', await token1155.getVersion())

    console.log('\n1155 owner addr :', await token1155.owner())
    console.log('\n-------------------------------------------------------------')
    console.log('Kmc  address :', kmcToken.address)
    console.log('1155 address :', token1155.address)
    console.log('Main address :', mainContract.address)
    console.log('-------------------------------------------------------------')
    console.log('')
  })



const version = '1'

task('permit-approve', 'Permits someone to execute the KMC Approve operation instead by verifying signature')
  .addParam('amount', 'The amount of KMC will be approved to spender')
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await hre.run('compile')

    const { mainContract, kmcToken } = await getDeployedContracts(hre)
    expect( kmcToken !== undefined )

    const name = await kmcToken.name() //'Kmc Token'
    console.log('token name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0] //token20.permit() caller
    const owner = accounts[1]   //creator
    const chainId = await owner.getChainId()

    const maxDeadline = hre.ethers.constants.MaxUint256

    const nonce = await kmcToken.nonces(owner.address)
    console.log('nonce=', nonce)

    const spender = mainContract.address
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
      spender: spender,
      value: kmcAmount,
      nonce: nonce,
      deadline: maxDeadline
    }

    console.log('data:', data)
    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    console.log('v, r, s:', v, r, s)

    const prompt = new Confirm('Continue to approve kmc?')
    const confirmation = await prompt.run()

    if (!confirmation) {
      console.log('You aborted the procedure !! ')
      return
    }

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

task('permit-create-article', 'Permits someone to execute new article creation operation instead by verifying signature')
  .setAction(async ({ _ }, hre) => {
    await hre.run('compile')

    const { mainContract, kmcToken } = await getDeployedContracts(hre)
    expect( mainContract !== undefined )
    expect( kmcToken !== undefined )

    const name = getDeployedMainContractName()
    console.log('contract name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0]
    const owner = accounts[1]
    const chainId = await owner.getChainId()

    //if owner has no enough allowance for create article, approve it by permit
    const deposit = await mainContract.articleDeposit()
    if (!await hasEnoughAllowance(kmcToken, owner.address, mainContract, deposit)) {
      await permitApproveKmc(kmcToken, owner, mainContract, deposit, hre)
    }
    //Just for test!!! if owner has enough kmc balance for create article, transfer it from accounts[0]
    if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
      await kmcToken.connect(caller).transfer(owner.address, deposit)
    }

    const nonce = await mainContract.nonces(owner.address)
    console.log('nonce=', nonce)

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const contentHash = getRandContentHash('aaa')

    const domain = buildDomain(name, version, chainId, mainContract.address)
    const types = {
      PermitCreateArticle: [  //PermitCreateArticle(bytes32 hash,address owner,uint256 nonce)
        {name: 'hash', type: 'bytes32'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }
    const data = {
      hash: contentHash,
      owner: owner.address,
      nonce: nonce,
    }
    console.log('domain:', domain)
    console.log('types:', types)
    console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    console.log('contentHash:', contentHash, typeof(contentHash))
    console.log('owner.addr:', owner.address)
    console.log('v, r, s:', v, r, s)

    const prompt = new Confirm('Continue to create article?')
    const confirmation = await prompt.run()

    if (!confirmation) {
      console.log('You aborted the procedure !! ')
      return
    }

    //test method and Event with argument
    const newArticleContractId = await mainContract.getArticleCount()
    console.log('newArticleContractId:', newArticleContractId)
    await expect(mainContract.connect(caller).permitCreateArticle(contentHash, owner.address, v, r, s))
      .to.emit(mainContract, 'ArticleCreated')
      .withArgs(owner.address, newArticleContractId, anyValue)


    // //test method and get receipt
    // const receipt = await mainContract.connect(caller).permitCreateArticle(contentHash, owner.address, v, r, s))
    // await receipt.wait()
    // console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await mainContract.nonces(owner.address)).to.be.equal(nonce.add(1))
    const ownerKmc = balanceOfOwner.sub(deploymentParams.ARTICLE_DEPOSIT)
    console.log('owner KMC:', ownerKmc)
    //expect(await kmcToken.balanceOf(owner.address)).to.be.equal(ownerKmc)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('native owner balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-create-article PASSED !!!!')
  })


task('permit-mint', 'Permits someone to execute article mint operation instead by verifying signature')
  .addParam('articleContractId', 'The article contract id will be minted')
  .addParam('amount', 'The amount of article will be minted')
  .setAction(async ({ articleContractId, amount }, hre) => {
    await hre.run('compile')

    const { mainContract, kmcToken } = await getDeployedContracts(hre)
    expect( mainContract !== undefined )
    expect( kmcToken !== undefined )

    const name = getDeployedMainContractName()
    console.log('contract name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0]
    const owner = accounts[1]
    const chainId = await owner.getChainId()

    //if owner has no enough allowance for mint, approve it by permit
    const deposit = await mainContract.mintDeposit()
    if (!await hasEnoughAllowance(kmcToken, owner.address, mainContract, deposit)) {
      await permitApproveKmc(kmcToken, owner, mainContract, deposit, hre)
    }
    //Just for test!!! if owner has enough kmc balance for mint, transfer it from accounts[0]
    if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
      await kmcToken.connect(caller).transfer(owner.address, deposit)
    }

    const nonce = await mainContract.nonces(owner.address)
    console.log('nonce=', nonce)

    console.log('param:', articleContractId, amount)

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const articleId = Number(articleContractId)
    const Amount = Number(amount)
    console.log('articleContractId:', articleId)
    console.log('Amount:', Amount)

    const domain = buildDomain(name, version, chainId, mainContract.address)
    const types = {
      PermitMint: [  //PermitMint(uint64 articleContractId,uint256 amount,address owner,uint256 nonce)
        {name: 'articleContractId', type: 'uint64'},
        {name: 'amount', type: 'uint256'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }
    const data = {
      owner: owner.address,
      articleContractId: articleId,
      amount: Amount,
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
    await expect(mainContract.connect(caller).permitMint(articleId, Amount, owner.address, v, r, s))
      .to.emit(mainContract, 'ArticleMinted')
      .withArgs(owner.address, articleId, Amount)


    // //test method and get receipt
    // const receipt = await mainContract.connect(caller).permitMint(articleContractId, Amount, owner.address, v, r, s))
    // await receipt.wait()
    // console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await mainContract.nonces(owner.address)).to.be.equal(nonce.add(1))
    const ownerKmc = balanceOfOwner.sub(deploymentParams.MINT_DEPOSIT)
    console.log('owner KMC:', ownerKmc)
    //expect(await kmcToken.balanceOf(owner.address)).to.be.equal(ownerKmc)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('native owner balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-mint PASSED !!!!')
  })