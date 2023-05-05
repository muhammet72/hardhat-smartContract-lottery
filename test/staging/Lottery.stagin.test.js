const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
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
