const hre = require("hardhat")
const {deployAllByProxy} = require("./utils");
const Confirm = require("prompt-confirm");


async function main() {

  console.log('Deploying contracts to network [%s] by script:', hre.network.name)
  console.log('Only used for deploying FIRST TIME !!! If want to upgrade the contract, please choose upgrade task or script.')

  const prompt = new Confirm('Continue to deploy ?')
  const confirmation = await prompt.run()

  if (!confirmation) {
    console.log('You aborted the procedure !!')
    return
  }

  const [admin] = await hre.ethers.getSigners()

  console.log("Deploying contracts with the account:", admin.address)
  console.log("Deployer native token balance:", (await admin.getBalance()).toString())

  const {everlazaar, kmcToken, accounts, chainId} = await deployAllByProxy(true, hre)

  await kmcToken.transfer(everlazaar.address, await kmcToken.totalSupply())

  console.log('')
  console.log('Main contract deployed. Address:', everlazaar.address)
  console.log('Kmc balance of main contract:', hre.ethers.utils.formatEther(await kmcToken.balanceOf(everlazaar.address)))
  console.log('Deployed Everlazaar, Kmc, ElzToken1155 to network[%s], chainId[%d] succeed !!!', hre.network.name, chainId)

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
