require("@nomiclabs/hardhat-waffle")
require("hardhat-gas-reporter");
const {task, types} = require("hardhat/config")

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()
  for (const account of accounts) {
    console.log(account.address)
  }
})

task("deploy:events", "Deploy the Events contract")
  .addOptionalParam("logs", "Print the logs", true, types.boolean)
  .setAction(async ({logs}, {ethers}) => {
    const Events = await ethers.getContractFactory("Events")
    const events = await Events.deploy()
    await events.deployed()
    logs && console.log(`Events contract has been deployed to: ${events.address}`)
    return events
  })


// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

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
}
