// const { ethers, network } = require("hardhat")
// const fs = require("fs")

// const FRONT_END_ADDRESSES_FILE = "../nextjs-smartcontract-lottery/constants/contractAddresses.json"
// const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json"

// module.exports = async () => {
//   if (process.env.UPDATE_FRONT_END) {
//     console.log("Updating front end ...")
//     updateContractAddresses()
//     updateAbi()
//   }
// }

// const updateAbi = async () => {
//   const lottery = await ethers.getContract("Lottery")
//   const chainId = network.config.chainId.toString()
//   //const currentAbi = JSON.parse(fs.readFileSync(FRONT_END_ABI_FILE))
//   fs.writeFileSync(FRONT_END_ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.jsonh))
// }

// const updateContractAddresses = async () => {
//   const lottery = await ethers.getContract("Lottery")
//   const chainId = network.config.chainId.toString()
//   const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
//   if (chainId in currentAddresses) {
//     if (!currentAddresses[chainId].includes(lottery.address)) {
//       currentAddresses[chainId].push(lottery.address)
//     }
//   }
//   {
//     currentAddresses[chainId] = [lottery.address]
//   }
//   fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses))

//   //
// }

// module.exports.tags = ["all", "frontend"]

const { frontEndContractsFile, frontEndAbiFile } = require("../helper-hardhat-config")
const fs = require("fs")
const { network } = require("hardhat")

module.exports = async () => {
  if (process.env.UPDATE_FRONT_END) {
    console.log("Writing to front end...")
    await updateContractAddresses()
    await updateAbi()
    console.log("Front end written!")
  }
}

async function updateAbi() {
  const lottery = await ethers.getContract("Lottery")
  fs.writeFileSync(frontEndAbiFile, lottery.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses() {
  const lottery = await ethers.getContract("Lottery")
  const contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"))
  if (network.config.chainId.toString() in contractAddresses) {
    if (!contractAddresses[network.config.chainId.toString()].includes(lottery.address)) {
      contractAddresses[network.config.chainId.toString()].push(lottery.address)
    }
  } else {
    contractAddresses[network.config.chainId.toString()] = [lottery.address]
  }
  fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses))
}
module.exports.tags = ["all", "frontend"]
