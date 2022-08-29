require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-ethers")
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter")
require('dotenv').config()
const {task, types} = require("hardhat/config")

task("deploy:events", "Deploy the Events contract")
  .addOptionalParam("logs", "Print the logs", true, types.boolean)
  .setAction(async ({logs}, {ethers}) => {
    const Events = await ethers.getContractFactory("Events")
    const events = await Events.deploy()
    await events.deployed()
    logs && console.log(`Events contract has been deployed to: ${events.address}`)
    return events
  })

task("deploy:polls", "Deploy the Polls contract")
  .addOptionalParam("logs", "Print the logs", true, types.boolean)
  .setAction(async ({logs}, {ethers}) => {
    const Polls = await ethers.getContractFactory("Polls")
    const polls = await Polls.deploy()
    await polls.deployed()
    logs && console.log(`Polls contract has been deployed to: ${polls.address}`)
    return polls
  })

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.16",
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./build"
  },
  networks: {
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.GOERLI_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
}
