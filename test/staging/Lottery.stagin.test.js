/*const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery", async function () {
      let lottery, lotteryEntranceFee, deployer

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        lottery = await ethers.getContract("Lottery", deployer)
        lotteryEntranceFee = await lottery.getEntranceFee()
      })

      describe("fulfillRandomWords", async () => {
        it("Works with live Chainlink VRF and Chinlink keepers, we get a random winner", async () => {
          // enter lottery
          const startingTimeStamp = await lottery.getLatestTimeStamp()
          const accounts = await ethers.getSigners()

          await new Promise(async (resolve, reject) => {
            lottery.once("Winnerpicked", async () => {
              console.log("Pinner picked event fired!")
              assert(endingTimeStamp > startingTimeStamp)

              resolve()

              try {
                // assert here
                const recentWinner = await lottery.getRecentWinner()
                const lotteryState = await lottery.getLotteryState()
                const winnerEndingBalance = await accounts[0].getBalance()
                const endingTimeStamp = await lottery.getLatestTimeStamp()

                await expect(lottery.getPlayer(0)).to.be.reverted
                assert.equal(recentWinner.toString(), accounts[0].address)
                assert.equal(lotteryState, 0)
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(lotteryEntranceFee).toString()
                )
                assert(endingTimeStamp > startingTimeStamp)
              } catch (error) {
                console.log(error)
                reject(e)
              }
            })
            // then entering lottery
            await lottery.enterLottery({ value: lotteryEntranceFee })
            const winnerStartingBalance = await accounts[0].getBalance()

            // and this code WON'T comilete until our listener has finished listening !!
          })
        })
      })
    })
    */
// Objective:
// To run tests on a staging network:
// 1. Get our SubId for Chainlink VRF and Fund it. SubId: 1604 (Source: https://vrf.chain.link/)
// 2. Deploy our contract using SubId.
// 3. Register the contract with Chainlink VRF & it's SudId.
// 4. Register the contract with Chainlink Keepers.
// 5. Run staging tests

const { getNamedAccounts, deployments, network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Unit Test", function () {
      let deployer, lottery, lotteryEntranceFee /* vrfCoordinatorV2Mock , interval; */
      /* const chainId = network.config.chainId */

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        /* await deployments.fixture(["all"]); */ // bcoz deploy scripts will deploy the contract here
        lottery = await ethers.getContract("Lottery", deployer)
        /* vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        ); */
        lotteryEntranceFee = await lottery.getEntranceFee()
        /* interval = await lottery.getInterval(); */
      })

      // Tests fullfillRandomWords function
      describe("fulfillRandomWords", function () {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
          // setup a listener before entering the lottery, just in case the blockchain moves really fast

          const startingTimeStamp = await lottery.getLatestTimeStamp()
          const accounts = await ethers.getSigners()

          // listener
          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              console.log("WinnerPicked event fired!")
              // Doing the asserts only after the winner is picked
              try {
                // asserts here:
                const recentWinner = await lottery.getRecentWinner()
                const lotteryState = await lottery.getLotteryState()
                const winnerEndingBalance = await accounts[0].getBalance()
                const endingTimeStamp = await lottery.getLatestTimeStamp()

                await expect(lottery.getPlayer(0)).to.be.reverted // lottery be be reset
                assert.equal(recentWinner.toString(), accounts[0].address) // players array has been reset
                assert.equal(lotteryState, 0) // state is OPEN
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(lotteryEntranceFee).toString()
                ) // money has been sent to winner
                assert(endingTimeStamp > startingTimeStamp)

                resolve()
              } catch (error) {
                console.log(error)
                reject(e)
              }
            })
            // enter the lottery
            await lottery.enterLottery({ value: lotteryEntranceFee }) // this code wont finish until the listener has finished listening
            const winnerStartingBalance = await accounts[0].getBalance()
          })
        })
      })
    })
