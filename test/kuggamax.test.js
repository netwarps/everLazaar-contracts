const hre = require('hardhat')
const { ethers} = require('hardhat')
const { expect } = require('chai')
const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

const {
  buildDomain,
  hasEnoughAllowance,
  giveAllowance,
  hasEnoughTokens,
  getRandItemHash,
  deployAllByProxy
} = require('../scripts/utils')

const deploymentParams = require('../tasks/deployment-params')
const {sha256, randomBytes} = require('ethers/lib/utils')
const {BigNumber} = require('ethers')

const version = '1'


const revertMsg = {
  token20PermitExpiredDeadline: 'expired deadline',
  permitInvalidSignature: 'invalid signature',
  noEnoughAllowanceForDeposit: 'insufficient allowance', //revert msg from ERC20
  noEnoughBalanceForDeposit: 'transfer amount exceeds balance', // revert msg from ERC20
  invalidLabId: 'invalid labId',
  notMemberOfLab: 'not a member of the lab',
  invalidItemId: 'invalid item id',
  notOwnerOfItem: 'not item owner',
  invalidMintAmount: 'invalid amount',
  itemTokenExisting: 'token existing',
  callerIsNotOwner: 'caller is not the owner',
  balanceIsNotEnough: 'withdraw amount exceeds balance'

}

/* Deploy Contracts for Unit Test */
const deployForTest = async () => {

  console.log('Deploying contracts to localhost for Unit Test ...')

  const {kuggamax, kmcToken, token1155, accounts, chainId} = await deployAllByProxy(false, hre)

  //Create a lab, and a item for test
  await createLabItem(kuggamax, kmcToken, accounts)

  return { kuggamax, kmcToken, token1155, accounts, chainId }

}

const createLabItem = async (kuggamax, kmcToken, accounts) => {
  const admin = accounts[0]
  const user = accounts[1]

  const labAssocId = Number(await kuggamax.getLabCount()) + 1
  console.log('')
  console.log('---------------------------------------')
  console.log('create Lab & Item for test-', labAssocId)

  let deposit = BigNumber.from(deploymentParams.LAB_DEPOSIT).add(deploymentParams.ITEM_DEPOSIT ).add(deploymentParams.MINT_DEPOSIT).toString()
  console.log('total deposit:', deposit)

  if (!await hasEnoughTokens(kmcToken, user.address, deposit)) {
    console.log('no enough kmc, transfer..')
    await kmcToken.connect(admin).transfer(user.address, deposit)
  }
  if (!await hasEnoughAllowance(kmcToken, user.address, kuggamax, deposit)) {
    console.log('no enough kmc allowance, approve..')
    await giveAllowance(kmcToken, user, kuggamax, deposit)
  }

  const title = 'Lab-' + (labAssocId - 1)
  const description = 'Description of ' + title
  await kuggamax.connect(user).createLab(labAssocId, title, description)

  const labId = await kuggamax.getLabCount() - 1
  expect(labId).to.be.eq(labAssocId - 1)

  console.log('Lab created, labId:', labId)

  const prevItemId = await kuggamax.getItemCount() - 1
  const hash = sha256(randomBytes(32))
  await kuggamax.connect(user).createItem(labId, hash)
  const itemId = await kuggamax.getItemCount() - 1
  expect(itemId).to.be.eq(prevItemId + 1)

  console.log('Item created, itemId:', itemId)
  console.log('---------------------------------------')
  console.log('')
}

const getSigners = (accounts) => {
  let caller, owner, otherOne
  caller = accounts[0] //admin
  owner = accounts[1]
  otherOne = accounts[2]

  return {caller, owner, otherOne}
}

const newToken20Name = 'Token20V2'
const newToken1155Name = 'Token1155V2'
const newKuggamaxName = 'KuggamaxV2'


describe('================ Kuggamax Contract Test start ==============', () => {
  let name

  describe('mint-revert', async () => {
    it('Require fail - the item Token1155 shall not be existed', async () => {

      const {kuggamax, kmcToken, accounts} = await loadFixture(deployForTest)

      console.log('-------------------------------------------------------------------')
      const {caller, owner} = getSigners(accounts)

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 1

      expect(itemId >= 0)

      const token1155 = await ethers.getContractAt('Token1155', await kuggamax.kugga1155())
      if (!await token1155.exists(itemId)) {
        //mint 1155 for test
        await kuggamax.connect(owner).mint(itemId, itemAmount)
        console.log('mint for itemId, amount:', itemId, itemAmount)

        expect(await token1155.exists(itemId)).to.be.true
      }

      await expect(kuggamax.connect(owner).mint(itemId, itemAmount))
        .to.be.revertedWith(revertMsg.itemTokenExisting)
    })

  })

  describe('\nadmin-withdraw-revert', async () => {

    it('Require fail - Not Kuggamax Owner', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts} = await loadFixture(deployForTest)
      const deployer = accounts[0]
      const otherOne = accounts[1]

      console.log('deployer:', deployer.address)
      console.log('otherOne:', otherOne.address)

      await expect(kuggamax.connect(otherOne).adminWithdraw(10)).to.be.revertedWith(revertMsg.callerIsNotOwner)

      await expect(kuggamax.connect(deployer).adminWithdraw(10)).to.be.revertedWith(revertMsg.balanceIsNotEnough)

    })

  })

  describe('\npermit-approve-revert', async () => {
    const ONE_DAY_IN_SECS = 24 * 60 * 60

    it('Require fail - Deadline shall be later than block.timestamp', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const spender = kuggamax //spender is kuggamax

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

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const spender = kuggamax //spender is kuggamax
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

  describe('\npermit-create-lab-revert', async () => {
    const types = {
      PermitCreateLab: [  //PermitCreateLab(string title,string description,address owner,uint256 nonce)
        {name: 'title', type: 'string'},
        {name: 'description', type: 'string'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it('Require fail - the owner shall be the create lab signature signer', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      name = 'Kuggamax'
      const domain = buildDomain(name, version, chainId, kuggamax.address)

      const title = 'Test Lab 1'
      const desc = 'Description of ' + title
      const nonce = await kuggamax.nonces(owner.address)
      console.log('nonce=', nonce)
      console.log('param:', title, desc)

      const data = {
        title: title,
        description: desc,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      const balance = await kmcToken.balanceOf(caller.address)
      console.log('balance:', balance)

      //assert the owner is the signature signer
      const labAssocId = Number(await kuggamax.getLabCount()) + 10
      console.log('labAssocId:', labAssocId)
      await expect(kuggamax.connect(caller).permitCreateLab(labAssocId, title, desc, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })

    it('Require fail - owner shall has enough kmc allowance for permitCreateLab', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      name = 'Kuggamax'
      const domain = buildDomain(name, version, chainId, kuggamax.address)

      const title = 'Test Lab 1'
      const desc = 'Description of ' + title
      const nonce = await kuggamax.nonces(owner.address)
      console.log('nonce=', nonce)
      console.log('param:', title, desc)

      const data = {
        title: title,
        description: desc,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      //clear the allowance of create lab deposit
      const deposit = deploymentParams.LAB_DEPOSIT
      if (await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
        await giveAllowance(kmcToken, owner.address, kuggamax, 0)
      }
      //assert the owner has enough kmc for create lab
      const labAssocId = Number(await kuggamax.getLabCount()) + 10
      console.log('labAssocId:', labAssocId)
      await expect(kuggamax.connect(caller).permitCreateLab(labAssocId, title, desc, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.noEnoughAllowanceForDeposit)
    })

    it('Require fail - owner shall has enough kmc balance for permitCreateLab', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      name = 'Kuggamax'
      const domain = buildDomain(name, version, chainId, kuggamax.address)

      const title = 'Test Lab 1'
      const desc = 'Description of ' + title
      const nonce = await kuggamax.nonces(owner.address)
      console.log('nonce=', nonce)
      console.log('param:', title, desc)

      const data = {
        title: title,
        description: desc,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      const labAssocId = Number(await kuggamax.getLabCount()) + 10
      console.log('labAssocId:', labAssocId)

      //if has no enough allowance, approve it
      const deposit = deploymentParams.LAB_DEPOSIT
      if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
        await giveAllowance(kmcToken, owner, kuggamax, deposit)
      }
      //clear owner's kmc balance for test
      if (await hasEnoughTokens(kmcToken, owner.address, deposit)) {
        console.log('do clear kmc balance')
        kmcToken.connect(owner).transfer(caller.address, 0)
      }

      //assert the owner has enough kmc for create lab
      await expect(kuggamax.connect(caller).permitCreateLab(labAssocId, title, desc, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.noEnoughBalanceForDeposit)
    })
  })

  describe('\npermit-create-item-revert', async () => {
    const types = {
      PermitCreateItem: [  //PermitCreateItem(uint64 labId,bytes32 hash,address owner,uint256 nonce)
        {name: 'labId', type: 'uint64'},
        {name: 'hash', type: 'bytes32'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it('Require fail - the owner shall be the create item signature signer', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const labId = await kuggamax.getLabCount() - 1
      const itemHash = getRandItemHash(labId)

      const name = 'Kuggamax'
      const nonce = await kuggamax.nonces(owner.address)
      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        labId: labId,
        hash: itemHash,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature) //fromRpcSig(signature)

      await expect(kuggamax.connect(caller).permitCreateItem(labId, itemHash, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })

    it('Require fail - labId shall be valid', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const labId = await kuggamax.getLabCount()
      const itemHash = getRandItemHash(labId)

      const name = 'Kuggamax'
      const nonce = await kuggamax.nonces(owner.address)
      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        labId: labId,
        hash: itemHash,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature) //fromRpcSig(signature)

      await expect(kuggamax.connect(caller).permitCreateItem(labId, itemHash, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.invalidLabId)
    })

    it('Require fail - owner must be member of lab', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      let {caller, owner, otherOne} = getSigners(accounts)

      const labId = await kuggamax.getLabCount() - 1
      const itemHash = getRandItemHash(labId)

      expect(labId >= 0)

      //switch value of owner and otherOne
      let t = owner
      owner = otherOne
      otherOne = t

      const name = 'Kuggamax'
      const nonce = await kuggamax.nonces(owner.address)
      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        labId: labId,
        hash: itemHash,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature) //fromRpcSig(signature)

      await expect(kuggamax.connect(caller).permitCreateItem(labId, itemHash, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.notMemberOfLab)
    })

  })

  describe('\npermit-mint-revert', async () => {
    const types = {
      PermitMint: [  //PermitMint(uint64 itemId,uint256 amount,address owner,uint256 nonce)
        {name: 'itemId', type: 'uint64'},
        {name: 'amount', type: 'uint256'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it('Require fail - the owner shall be the item mint signature signer', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = 'Kuggamax'

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 1
      const nonce = await kuggamax.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })

    it('Require fail - the itemId shall be smaller than item count', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = 'Kuggamax'

      const itemId = await kuggamax.getItemCount() //invalid itemId
      const itemAmount = 1
      const nonce = await kuggamax.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.invalidItemId)
    })

    it('Require fail - the owner shall be the item owner', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      let {caller, owner, otherOne} = getSigners(accounts)

      const name = 'Kuggamax'

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 1
      const nonce = await kuggamax.nonces(owner.address)

      expect(itemId >= 0)

      //switch value of owner and otherOne
      let t = owner
      owner = otherOne
      otherOne = t

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.notOwnerOfItem)
    })

    it('Require fail - the amount shall be greater than 0', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = 'Kuggamax'

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 0
      const nonce = await kuggamax.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.invalidMintAmount)
    })

    it('Require fail - the item Token1155 shall not be exist', async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployForTest)
      const {caller, owner, otherOne} = getSigners(accounts)

      //create lab2 item2 for permitMint
      await createLabItem(kuggamax, kmcToken, accounts)

      const name = 'Kuggamax'

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 1
      const nonce = await kuggamax.nonces(owner.address)
      console.log('itemId:', itemId)
      expect(itemId >= 0)

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      let data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      console.log('itemId:', itemId)
      const token1155 = await ethers.getContractAt('Token1155', await kuggamax.kugga1155())
      if (!await token1155.exists(itemId)) {
        const signature = await owner._signTypedData(domain, types, data)
        const { v, r, s } = ethers.utils.splitSignature(signature)
        //mint 1155 for test
        await kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s)
        console.log('mint for itemId,amount:', itemId, itemAmount)

        expect(await token1155.exists(itemId)).to.be.true

        //get next nonce
        data.nonce = await kuggamax.nonces(owner.address)
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.itemTokenExisting)
    })

  })

  describe('\nupgrade-test', async () => {
    it('upgrade Token20 - upgrade and check old data', async () => {

      const {kuggamax, kmcToken, accounts} = await loadFixture(deployForTest)

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

      console.log('version:', await newKmcToken.version())
      await newKmcToken.setVersion('2', {from: admin.address})
      expect(await newKmcToken.version()).to.equal('2')
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
      const {kuggamax, token1155, accounts} = await loadFixture(deployForTest)

      console.log('-------------------------------------------------------------------')

      const admin = accounts[0]
      const user1 = accounts[1]

      const itemId = await kuggamax.getItemCount() - 1
      const amount = 10
      await kuggamax.connect(user1).mint(itemId, amount)

      const NewToken1155 = await ethers.getContractFactory(newToken1155Name)
      const newToken1155 = await hre.upgrades.upgradeProxy(token1155.address, NewToken1155)

      console.log('old token1155 proxy addr:', token1155.address)
      console.log('new token1155 proxy addr:', newToken1155.address)
      expect(newToken1155.address).to.equal(token1155.address)

      console.log('version:', await newToken1155.version())

      expect(await newToken1155.totalSupply(itemId)).to.equal(amount)
      expect(await newToken1155.balanceOf(user1.address, itemId)).to.equal(amount)
    })

    it('upgrade Kuggamax - upgrade and check old data', async () => {
      const {kuggamax, token1155, accounts} = await loadFixture(deployForTest)

      console.log('-------------------------------------------------------------------')

      const admin = accounts[0]
      const user1 = accounts[1]

      const NewKuggamax = await ethers.getContractFactory(newKuggamaxName)
      const newKuggamax = await hre.upgrades.upgradeProxy(kuggamax.address, NewKuggamax)

      console.log('old kuggamax proxy addr:', kuggamax.address)
      console.log('new kuggamax proxy addr:', newKuggamax.address)
      expect(newKuggamax.address).to.equal(kuggamax.address)

      console.log('version:', await newKuggamax.version())
      await newKuggamax.setVersion('2.1', {from: admin.address})
      expect(await newKuggamax.version()).to.equal('2.1')
      console.log('version:', await newKuggamax.version())

      expect(await newKuggamax.getLabCount()).to.equal(2)
      expect(await newKuggamax.getItemCount()).to.equal(2)
    })
  })

})

