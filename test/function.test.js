const hre = require('hardhat')
const { ethers} = require('hardhat')
const { expect } = require('chai')
const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

const {
  buildDomain,
  hasEnoughAllowance,
  giveAllowance,
  hasEnoughTokens,
  getRandContentHash,
  deployAllByProxy,
  getDeployedMainContractName,
  getDeployedToken1155Name, getDeployedContracts, permitApproveKmc
} = require('../scripts/utils')

const deploymentParams = require('../tasks/deployment-params')
const {sha256, randomBytes} = require('ethers/lib/utils')
const {BigNumber} = require('ethers')
const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const version = '1'


const revertMsg = {
  token20PermitExpiredDeadline: 'expired deadline',
  permitInvalidSignature: 'invalid signature',
  noEnoughAllowanceForDeposit: 'insufficient allowance', //revert msg from ERC20
  noEnoughBalanceForDeposit: 'transfer amount exceeds balance', // revert msg from ERC20
  invalidArticleContractId: 'invalid articleContractId',
  notOwnerOfArticle: 'not article owner',
  invalidMintAmount: 'invalid amount',
  articleTokenExisting: 'token existing',
  callerIsNotOwner: 'caller is not the owner',
  balanceIsNotEnough: 'withdraw amount exceeds balance'

}

/* Deploy Contracts for Unit Test */
const deployForTest = async () => {

  console.log('Deploying contracts to localhost for Unit Test ...')

  const {mainContract, kmcToken, token1155, accounts, chainId} = await deployAllByProxy(false, hre)

  //Create a article for test
  await permitCreateTestArticle(mainContract, kmcToken, accounts)

  return { mainContract, kmcToken, token1155, accounts, chainId }

}

const createTestArticle = async (mainContract, kmcToken, accounts) => {
  const admin = accounts[0]
  const user = accounts[1]

  console.log('')
  console.log('---------------------------------------')
  console.log('create Article for test-')

  let deposit = BigNumber.from(deploymentParams.ARTICLE_DEPOSIT ).add(deploymentParams.MINT_DEPOSIT).toString()
  console.log('total deposit:', deposit)

  if (!await hasEnoughTokens(kmcToken, user.address, deposit)) {
    console.log('no enough kmc, transfer..')
    await kmcToken.connect(admin).transfer(user.address, deposit)
  }
  if (!await hasEnoughAllowance(kmcToken, user.address, mainContract, deposit)) {
    console.log('no enough kmc allowance, approve..')
    await giveAllowance(kmcToken, user, mainContract, deposit)
  }

  const prevId = await mainContract.getArticleCount() - 1
  const hash = sha256(randomBytes(32))
  await mainContract.connect(user).createArticle(hash)
  const articleContractId = await mainContract.getArticleCount() - 1
  expect(articleContractId).to.be.eq(prevId + 1)

  console.log('Article created, articleContractId:', articleContractId)
  console.log('---------------------------------------')
  console.log('')
}

const permitCreateTestArticle = async (mainContract, kmcToken, accounts) => {
  console.log('------------- permitCreateTestArticle --------------------------')

  const name = getDeployedMainContractName()
  console.log('contract name:', name)

  const caller = accounts[0]
  const owner = accounts[1]
  const chainId = await owner.getChainId()

  //if owner has no enough allowance for create article, approve it by permit
  const deposit = deploymentParams.ARTICLE_DEPOSIT
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

  const contentHash = getRandContentHash()
  console.log('contentHash:', contentHash, typeof(contentHash))

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

  const signature = await owner._signTypedData(domain, types, data)
  //console.log('signature:', signature)
  const { v, r, s } = hre.ethers.utils.splitSignature(signature)
  // console.log('v, r, s:', v, r, s)

  //test method and Event with argument
  const newArticleContractId = await mainContract.getArticleCount()
  console.log('newArticleContractId:', newArticleContractId)
  await expect(mainContract.connect(caller).permitCreateArticle(contentHash, owner.address, v, r, s))
    .to.emit(mainContract, "ArticleCreated")
    .withArgs(owner.address, newArticleContractId, anyValue)
}

const getSigners = (accounts) => {
  let caller, owner, otherOne
  caller = accounts[0] //admin
  owner = accounts[1]
  otherOne = accounts[2]

  return {caller, owner, otherOne}
}

const newToken20Name = 'KmcToken'
const newToken1155Name = 'ElzToken1155'
const newMainContractName = 'Everlazaar'


describe('================ Everlazaar Contract Test start ==============', () => {
  let name

  // describe('mint-revert', async () => {
  //   it('Require fail - the Token1155 shall not be existed', async () => {
  //
  //     const {mainContract, kmcToken, accounts} = await loadFixture(deployForTest)
  //
  //     console.log('-------------------------------------------------------------------')
  //     const {caller, owner} = getSigners(accounts)
  //
  //     const articleContractId = await mainContract.getArticleCount() - 1
  //     const Amount = 1
  //
  //     console.log('articleContractId=', articleContractId)
  //     expect(articleContractId >= 0)
  //
  //     const token1155 = await ethers.getContractAt(getDeployedToken1155Name(), await mainContract.token1155())
  //     if (!await token1155.exists(articleContractId)) {
  //       //mint 1155 for test
  //       await mainContract.connect(owner).mint(articleContractId, Amount)
  //       console.log('mint for articleContractId, amount:', articleContractId, Amount)
  //
  //       expect(await token1155.exists(articleContractId)).to.be.true
  //     }
  //
  //     await expect(mainContract.connect(owner).mint(articleContractId, Amount))
  //       .to.be.revertedWith(revertMsg.articleTokenExisting)
  //   })
  //
  // })

  describe('\nadmin-withdraw-revert', async () => {

    it('Require fail - Not MainContract Owner', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts} = await loadFixture(deployForTest)
      const deployer = accounts[0]
      const otherOne = accounts[1]

      console.log('deployer:', deployer.address)
      console.log('otherOne:', otherOne.address)

      await expect(mainContract.connect(otherOne).adminWithdraw(10)).to.be.revertedWith(revertMsg.callerIsNotOwner)

      await expect(mainContract.connect(deployer).adminWithdraw(10)).to.be.revertedWith(revertMsg.balanceIsNotEnough)

    })

  })

  describe('\npermit-approve-revert', async () => {
    const ONE_DAY_IN_SECS = 24 * 60 * 60

    it('Require fail - Deadline shall be later than block.timestamp', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const spender = mainContract //spender is mainContract

      console.log('owner:', owner.address)
      console.log('spender:', spender.address)

      const value = 10
      const deadline = (await time.latest()) - ONE_DAY_IN_SECS //deadline < block.timestamp

      const v = Number(28)
      const r = '0x2710cfc11cd7e17ef5dab6a4f61d0f04128d63c6aa829dfecef7ace665ea5b34'
      const s = '0x64bea4435039cedaf1350199bfc90fda6a78e490be2cbed6e9898da00e2d1619'

      // assert that the deadline is correct
      await expect(kmcToken.connect(caller).permit(owner.address, spender.address, value, deadline, v, r, s))
        .to.be.revertedWith(revertMsg.token20PermitExpiredDeadline)
    })

    it('Require fail - the owner shall be the signature signer', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const spender = mainContract //spender is mainContract
      name = await kmcToken.name()
      const value = 10
      const deadline = (await time.latest()) + ONE_DAY_IN_SECS //deadline > block.timestamp

      const nonce = await kmcToken.nonces(owner.address)
      console.log('nonce=', nonce)

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
        value: value,
        nonce: nonce,
        deadline: deadline
      }

      const signature = await owner._signTypedData(domain, types, data)
      const {v, r, s} = ethers.utils.splitSignature(signature)
      console.log('v,r,s:', v, r, s)

      // const receipt = await kmcToken.connect(caller).permit(otherOne.address, spender.address, value, deadline, v, r, s)
      // console.log(receipt)

      await expect(kmcToken.connect(caller).permit(otherOne.address, spender.address, value, deadline, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })
  })

  describe('\npermit-create-article-revert', async () => {
    const types = {
      PermitCreateArticle: [  //PermitCreateArticle(bytes32 hash,address owner,uint256 nonce)
        {name: 'hash', type: 'bytes32'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it('Require fail - the owner shall be the create article signature signer', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const contentHash = getRandContentHash()

      const name = getDeployedMainContractName()
      const nonce = await mainContract.nonces(owner.address)
      const domain = buildDomain(name, version, chainId, mainContract.address)
      const data = {
        hash: contentHash,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature) //fromRpcSig(signature)

      await expect(mainContract.connect(caller).permitCreateArticle(contentHash, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })

  })

  describe('\npermit-mint-revert', async () => {
    const types = {
      PermitMint: [  //PermitMint(uint64 articleContractId,uint256 amount,address owner,uint256 nonce)
        {name: 'articleContractId', type: 'uint64'},
        {name: 'amount', type: 'uint256'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it('Require fail - the owner shall be the article mint signature signer', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = getDeployedMainContractName()

      const articleContractId = await mainContract.getArticleCount() - 1
      const Amount = 1
      const nonce = await mainContract.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, mainContract.address)
      const data = {
        owner: owner.address,
        articleContractId: articleContractId,
        amount: Amount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(mainContract.connect(caller).permitMint(articleContractId, Amount, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })

    it('Require fail - the articleContractId shall be smaller than article count', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = getDeployedMainContractName()

      const articleContractId = await mainContract.getArticleCount() //invalid articleContractId
      const Amount = 1
      const nonce = await mainContract.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, mainContract.address)
      const data = {
        owner: owner.address,
        articleContractId: articleContractId,
        amount: Amount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(mainContract.connect(caller).permitMint(articleContractId, Amount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.invalidArticleContractId)
    })

    it('Require fail - the owner shall be the article owner', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      let {caller, owner, otherOne} = getSigners(accounts)

      //switch owner and otherOne
      let t = owner
      owner = otherOne
      otherOne = t

      const name = getDeployedMainContractName()

      const articleContractId = await mainContract.getArticleCount() - 1
      const Amount = 1
      const nonce = await mainContract.nonces(owner.address)

      expect(articleContractId >= 0)

      const domain = buildDomain(name, version, chainId, mainContract.address)
      const data = {
        owner: owner.address,
        articleContractId: articleContractId,
        amount: Amount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(mainContract.connect(caller).permitMint(articleContractId, Amount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.notOwnerOfArticle)
    })

    it('Require fail - the amount shall be greater than 0', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = getDeployedMainContractName()

      const articleContractId = await mainContract.getArticleCount() - 1
      const Amount = 0
      const nonce = await mainContract.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, mainContract.address)
      const data = {
        owner: owner.address,
        articleContractId: articleContractId,
        amount: Amount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(mainContract.connect(caller).permitMint(articleContractId, Amount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.invalidMintAmount)
    })

    it('Require fail - the Token1155 shall not be exist', async () => {
      console.log('-------------------------------------------------------------------')

      const {mainContract, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      //create for permitMint
      //await permitCreateTestArticle(mainContract, kmcToken, accounts)

      //if owner has no enough allowance for mint article, approve it by permit
      const deposit = deploymentParams.MINT_DEPOSIT
      if (!await hasEnoughAllowance(kmcToken, owner.address, mainContract, deposit)) {
        await permitApproveKmc(kmcToken, owner, mainContract, deposit, hre)
      }
      //Just for test!!! if owner has no enough kmc balance for mint article, transfer it from accounts[0]
      if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
        await kmcToken.connect(caller).transfer(owner.address, deposit)
      }

      const name = getDeployedMainContractName()

      const articleContractId = await mainContract.getArticleCount() - 1
      const Amount = 1
      const nonce = await mainContract.nonces(owner.address)
      console.log('articleContractId:', articleContractId)
      expect(articleContractId >= 0)

      const domain = buildDomain(name, version, chainId, mainContract.address)
      let data = {
        owner: owner.address,
        articleContractId: articleContractId,
        amount: Amount,
        nonce: nonce,
      }

      console.log('articleContractId:', articleContractId)
      const token1155 = await ethers.getContractAt(getDeployedToken1155Name(), await mainContract.token1155())
      if (!await token1155.exists(articleContractId)) {
        const signature = await owner._signTypedData(domain, types, data)
        const { v, r, s } = ethers.utils.splitSignature(signature)
        //mint 1155 for test
        await mainContract.connect(caller).permitMint(articleContractId, Amount, owner.address, v, r, s)
        console.log('mint for articleContractId,amount:', articleContractId, Amount)

        expect(await token1155.exists(articleContractId)).to.be.true

        //get next nonce
        data.nonce = await mainContract.nonces(owner.address)
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(mainContract.connect(caller).permitMint(articleContractId, Amount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.articleTokenExisting)
    })

  })

  describe('\nupgrade-test', async () => {
    it('upgrade Token20 - upgrade and check old data', async () => {

      const {mainContract, kmcToken, accounts} = await loadFixture(deployForTest)

      console.log('-------------------------------------------------------------------')

      const admin = accounts[0]
      const user1 = accounts[1]

      const amount = ethers.utils.parseEther('2')
      await kmcToken.transfer(user1.address, amount, { from: admin.address })

      const oldSupply = await kmcToken.totalSupply()
      const oldAdminBalance = await kmcToken.balanceOf(admin.address)
      const oldUser1Balance = await kmcToken.balanceOf(user1.address)

      console.log('amount=', amount)
      console.log('old supply :', oldSupply)
      console.log('old admin balance:', oldAdminBalance)
      console.log('old user1 balance:', oldUser1Balance)

      const NewKmcToken = await ethers.getContractFactory(newToken20Name)
      const newKmcToken = await hre.upgrades.upgradeProxy(kmcToken.address, NewKmcToken)

      // console.log('version:', await newKmcToken.version())
      // await newKmcToken.setVersion('2', {from: admin.address})
      // expect(await newKmcToken.version()).to.equal('2')
      expect(await newKmcToken.totalSupply()).to.equal(oldSupply)

      const adminBalance = await newKmcToken.balanceOf(admin.address)
      const user1Balance = await newKmcToken.balanceOf(user1.address)

      console.log('new admin balance:', adminBalance)
      console.log('new user1 balance:', user1Balance)

      expect(user1Balance).to.eq(oldUser1Balance)
      expect(adminBalance).to.equal(oldAdminBalance)
      expect(oldAdminBalance.sub(adminBalance)).to.eq(user1Balance.sub(oldUser1Balance))

      console.log('old kmcToken proxy addr:', kmcToken.address)
      console.log('new kmcToken proxy addr:', newKmcToken.address)
      expect(newKmcToken.address).to.equal(kmcToken.address)
    })

    it('upgrade Token1155 - upgrade and check old data', async () => {
      const {mainContract, token1155, accounts} = await loadFixture(deployForTest)

      console.log('-------------------------------------------------------------------')

      const admin = accounts[0]
      const user1 = accounts[1]

      const articleContractId = await mainContract.getArticleCount() - 1
      const amount = 10
      //await mainContract.connect(user1).mint(articleContractId, amount)

      const NewToken1155 = await ethers.getContractFactory(newToken1155Name)
      const newToken1155 = await hre.upgrades.upgradeProxy(token1155.address, NewToken1155)

      console.log('old token1155 proxy addr:', token1155.address)
      console.log('new token1155 proxy addr:', newToken1155.address)
      expect(newToken1155.address).to.equal(token1155.address)

      //console.log('version:', await newToken1155.version())

      //expect(await newToken1155.totalSupply(articleContractId)).to.equal(amount)
      //expect(await newToken1155.balanceOf(user1.address, articleContractId)).to.equal(amount)
    })

    it('upgrade mainContract - upgrade and check old data', async () => {
      const {mainContract, token1155, accounts} = await loadFixture(deployForTest)

      console.log('-------------------------------------------------------------------')

      const admin = accounts[0]
      const user1 = accounts[1]

      const NewFactory = await ethers.getContractFactory(newMainContractName)
      const newMainContract = await hre.upgrades.upgradeProxy(mainContract.address, NewFactory)

      console.log('old mainContract proxy addr:', mainContract.address)
      console.log('new mainContract proxy addr:', newMainContract.address)
      expect(newMainContract.address).to.equal(mainContract.address)

      // console.log('version:', await newMainContract.version())
      // await newMainContract.setVersion('2.1', {from: admin.address})
      // expect(await newMainContract.version()).to.equal('2.1')
      // console.log('version:', await newMainContract.version())

      expect(await newMainContract.getArticleCount()).to.equal(2)
    })
  })

})

