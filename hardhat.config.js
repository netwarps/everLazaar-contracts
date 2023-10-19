require("@nomiclabs/hardhat-waffle");
require('@openzeppelin/hardhat-upgrades');
require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-etherscan')

require("./tasks/deploy-upgrade-tasks");
require("./tasks/function-tasks");

// require('dotenv').config();
require('dotenv').config({path: '.env.test.ucl.mainnet'});
// require('dotenv').config({path: '.env.test.ucl'});
// require('dotenv').config({path: '.env.prod'});

const { POLYGON_MUMBAI_RPC_PROVIDER, POLYGONSCAN_API_KEY } = process.env;

const ACCOUNT_PRIVATE_KEY = process.env.ACCOUNT_PRIVATE_KEY;
const USER_ACCOUNT_PRIVATE_KEY = process.env.USER_ACCOUNT_PRIVATE_KEY
const NODE_API_KEY = process.env.INFURA_API_KEY || process.env.ALCHEMY_API_KEY;
const isInfura = !!process.env.INFURA_API_KEY;


if ((!ACCOUNT_PRIVATE_KEY || !NODE_API_KEY)) {
  console.error("Please set a ACCOUNT_PRIVATE_KEY and ALCHEMY_API_KEY or INFURA_API_KEY.");
  process.exit(0);
}

const polygonMainNetNodeUrl = isInfura
  ? "https://polygon-mainnet.infura.io/v3/" + NODE_API_KEY
  : "https://polygon-mainnet.g.alchemy.com/v2/" + NODE_API_KEY;

const polygonMumbaiNodeUrl = isInfura
  ? "https://polygon-mumbai.infura.io/v3/" + NODE_API_KEY
  : "https://polygon-mumbai.g.alchemy.com/v2/" + NODE_API_KEY;


// Go to https://www.alchemyapi.io, sign up, create
// a new App in its dashboard, and replace "KEY" with its key
// const ALCHEMY_API_KEY = "KEY";

// // Replace this private key with your Ropsten account private key
// // To export your private key from Metamask, open Metamask and
// // go to Account Details > Export Private Key
// // Be aware of NEVER putting real Ether into testing accounts
// const ROPSTEN_PRIVATE_KEY = "fac50ba7eb2bcbf8c80abd07732abee20d8b0d30a4099cfe065e010d4cd212d7";

// const MATIC_PRIVATE_KEY = "fac50ba7eb2bcbf8c80abd07732abee20d8b0d30a4099cfe065e010d4cd212d7"

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  //defaultNetwork: 'maticmum',
  defaultNetwork: 'localhost',
  solidity: {
    version:  "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 2000,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      }
    }
  },

  etherscan: {
    apiKey: POLYGONSCAN_API_KEY
  },

  networks: {
    localhost: {
      deployedContracts: {
        mainContract: '0x0165878A594ca255338adfa4d48449f69242Eb8F'
      }
    },
    // ropsten: {
    //   url: `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
    //   accounts: [`0x${ROPSTEN_PRIVATE_KEY}`]
    // },
    // mumbai: {
    //   url: `https://rpc-mumbai.maticvigil.com/`,
    //   accounts: [`0x${MATIC_PRIVATE_KEY}`],
    //   deployedContracts: {
    //     mainContract: '0xdf6B79624a2fc9C84ca7029e677ab482cF4BE2A0',
    //   }
    // },
    matic: { //main net
      url: polygonMainNetNodeUrl,
      accounts: [`0x${ACCOUNT_PRIVATE_KEY}`],
      deployedContracts:{
        mainContract: '0x xxx'
      }
    },
    maticmum_pdm: { //HK paradeum test
        url: polygonMumbaiNodeUrl,
        gasLimit:46000000,
        accounts: [`0x${ACCOUNT_PRIVATE_KEY}`, `0x${USER_ACCOUNT_PRIVATE_KEY}`],
        deployedContracts:{
          mainContract: '0x80D8151D3FBe2D82D2657d389A7247AB1d3815C9'
        }
    },
    maticmum_ucl: { //HK ucloud test
      url: polygonMumbaiNodeUrl,
      gasLimit:46000000,
      accounts: [`0x${ACCOUNT_PRIVATE_KEY}`, `0x${USER_ACCOUNT_PRIVATE_KEY}`],
      deployedContracts:{
        mainContract: '0x5B89Fae308e78CB67B79623F0854A0B53107D1C4'
      }
    },
    polygonMainNet_ucl: { //HK ucloud test on main net
      url: polygonMainNetNodeUrl,
      gasLimit:86000000,
      accounts: [`0x${ACCOUNT_PRIVATE_KEY}`, `0x${USER_ACCOUNT_PRIVATE_KEY}`],
      deployedContracts:{
        mainContract: '0x111'
      },
      timeout: 240000
    }
  }
};
