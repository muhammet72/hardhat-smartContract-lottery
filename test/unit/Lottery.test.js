const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery", async function () {
      let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer, interval
      const chainId = network.config.chainId

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        lottery = await ethers.getContract("Lottery", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        lotteryEntranceFee = await lottery.getEntranceFee()
        interval = await lottery.getInterval()
      })
      describe("constructor", async () => {
        it("initializes the Lottery correctly", async () => {
          // ideally we make our tests just 1 assert per "it"
          const lotteryState = await lottery.getLotteryState()
          assert.equal(lotteryState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })
      describe("enterLottery", async () => {
        it("revert when you don't pay enough", async () => {
          await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__NotEnoughETHEntered")
        })
        it("record players when they enter ", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          const playerFromContract = await lottery.getPlayer(0)
          assert.equal(playerFromContract, deployer)
        })
        it("emits event on enter", async () => {
          await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
            lottery,
            "LotteryEnter"
          )
        })
        it("doesn't allow enterance when lottery is caculating", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          // we pretend to be a Chainlink keeper
          await lottery.performUpkeep([])
          await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.be.revertedWith(
            "Lottery__NotOpen"
          )
        })
      })
      describe("checkUpkeep", async () => {
        it("return false if people haven't send any ETH", async () => {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          assert(!upkeepNeeded)
        })
        it("return false if lottery isn't open", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          await lottery.performUpkeep([])
          const lotteryState = await lottery.getLotteryState()
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          assert.equal(lotteryState.toString(), 1)
          assert.equal(upkeepNeeded, false)
        })
        it("return false if enough time hasn't passed", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 5])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
          assert(!upkeepNeeded)
        })
        it("return true if enough time has passed, has players, eth and is open", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
          assert(upkeepNeeded)
        })
      })
      describe("performUpkeep", async () => {
        it("it can only run if checkUpkeep is true", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const tx = await lottery.performUpkeep([])
          assert(tx)
        })
        it("revert when checkUpkeep is false", async () => {
          await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpkeepNotNeeded")
        })
        it("update the lottery state , emit the event, and calls the vrf coordinator", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const txResponse = await lottery.performUpkeep([])
          const txReciept = await txResponse.wait(1)
          const requestId = txReciept.events[1].args.requestId
          const lotteryState = await lottery.getLotteryState()
          assert(requestId.toNumber() > 0)
          assert(lotteryState.toString() == "1")
        })
      })
      describe("fulfillRandomWords", async () => {
        beforeEach(async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
        })
        it("can only be called after performUpkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
          ).to.be.revertedWith("nonexistent request")
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
          ).to.be.revertedWith("nonexistent request")
        })

        // wayyyyyyyyyyyy too bigggg
        it("picks a winner, reset the lottery, and send money", async () => {
          const additionalEntrants = 3
          const startingAccountIndex = 1 // deployer = 0
          const accounts = await ethers.getSigners()

          for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
            const accountConnectedLottery = lottery.connect(accounts[i])
            await accountConnectedLottery.enterLottery({ value: lotteryEntranceFee })
          }
          const startingTimeStamp = await lottery.getLatestTimeStamp()

          // performUpkeep (mock being chainlink keeper)
          // fulfilledRandomWords (mock being chainlink VRF)
          // we will have to wait for fulfilledRandomWords to be called
          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              console.log("Found the event!")
              try {
                const recentWinner = await lottery.getRecentWinner()
                const lotteryState = await lottery.getLotteryState()
                const endingTimeStamp = await lottery.getLatestTimeStamp()
                const numPlayers = await lottery.getNumPlayers()
                const winnerEndingBalance = await accounts[1].getBalance()

                console.log(recentWinner)
                console.log(accounts[0].address)
                console.log(accounts[1].address)
                console.log(accounts[2].address)
                console.log(accounts[3].address)

                assert.equal(numPlayers.toString(), "0")
                assert.equal(lotteryState.toString(), "0")
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance
                    .add(lotteryEntranceFee.mul(additionalEntrants).add(lotteryEntranceFee))
                    .toString()
                )
                assert(endingTimeStamp > startingTimeStamp)

                resolve()
              } catch (e) {
                reject(e)
              }
            })
            // setting up the listener
            //below, we will fire the event, and the listener will pick it up , and resolve
            const tx = await lottery.performUpkeep([])
            const txReciept = await tx.wait(1)
            const winnerStartingBalance = await accounts[1].getBalance()
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReciept.events[1].args.requestId,
              lottery.address
            )
          })
        })
      })
    })
