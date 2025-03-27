import { 
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("EXAToken Basic Tests", function () {
  // Contract deployment fixture
  async function deployTokenFixture() {
    // Get the accounts
    const [owner, addr1, addr2] = await ethers.getSigners();

    // Get the EXAToken contract factory
    const EXAToken = await ethers.getContractFactory("EXAToken");
    
    // Deploy EXAToken
    const exa = await EXAToken.deploy();
    const deployedAddress = await exa.getAddress();

    return { exa, owner, addr1, addr2 };
  }

  describe("ERC20 Basic Properties Tests", function () {
    it("Token name should be 'EstateX Protocol'", async function () {
      const { exa } = await loadFixture(deployTokenFixture);
      const name = await exa.name();
      expect(name).to.equal("EstateX Protocol");
    });

    it("Token symbol should be 'EXA'", async function () {
      const { exa } = await loadFixture(deployTokenFixture);
      const symbol = await exa.symbol();
      expect(symbol).to.equal("EXA");
    });

    it("Token decimals should be 18", async function () {
      const { exa } = await loadFixture(deployTokenFixture);
      const decimals = await exa.decimals();
      expect(decimals).to.equal(18);
    });

    it("Initial total supply should be 1 billion * 10^18", async function () {
      const { exa } = await loadFixture(deployTokenFixture);
      const totalSupply = await exa.totalSupply();
      
      // Expected value: 1 billion * 10^18
      const expectedSupply = ethers.parseUnits("1000000000", 18);
      
      expect(totalSupply).to.equal(expectedSupply);
    });

    it("Initial supply should be allocated to the deployer (owner)", async function () {
      const { exa, owner } = await loadFixture(deployTokenFixture);
      const totalSupply = await exa.totalSupply();
      const ownerBalance = await exa.balanceOf(owner.address);
      
      expect(ownerBalance).to.equal(totalSupply);
    });
  });

  describe("Transfer Function Tests", function() {
    it("transfer() - Should be able to transfer tokens between accounts", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // Amount to transfer (100 EXA)
      const transferAmount = ethers.parseUnits("100", 18);
      
      // Check balances before transfer
      const ownerBalanceBefore = await exa.balanceOf(owner.address);
      const addr1BalanceBefore = await exa.balanceOf(addr1.address);
      
      // Transfer tokens from owner to addr1
      await expect(
        exa.transfer(addr1.address, transferAmount)
      ).to.changeTokenBalances(
        exa, 
        [owner, addr1], 
        [transferAmount * BigInt(-1), transferAmount]
      );
      
      // Check balances after transfer
      const ownerBalanceAfter = await exa.balanceOf(owner.address);
      const addr1BalanceAfter = await exa.balanceOf(addr1.address);
      
      // Transfer to another account
      await expect(
        exa.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.changeTokenBalances(
        exa, 
        [addr1, addr2], 
        [transferAmount * BigInt(-1), transferAmount]
      );
      
      const addr2BalanceAfter = await exa.balanceOf(addr2.address);
    });
    
    it("transfer() - Should emit Transfer event when transferring tokens", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // Amount to transfer (50 EXA)
      const transferAmount = ethers.parseUnits("50", 18);
      
      // Check that a Transfer event is emitted
      await expect(exa.transfer(addr1.address, transferAmount))
        .to.emit(exa, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);
    });
    
    it("transferFrom() - Should emit Transfer event when transferring tokens", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // Amount to approve (100 EXA)
      const approveAmount = ethers.parseUnits("100", 18);
      
      // Grant addr1 permission to transfer owner's tokens
      await exa.approve(addr1.address, approveAmount);
      
      // Amount to transfer (75 EXA)
      const transferAmount = ethers.parseUnits("75", 18);
      
      // Check that a Transfer event is emitted
      await expect(exa.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount))
        .to.emit(exa, "Transfer")
        .withArgs(owner.address, addr2.address, transferAmount);
    });
    
    it("approve() - Should emit Approval event when approving", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // Amount to approve (50 EXA)
      const approveAmount = ethers.parseUnits("50", 18);
      
      // Check that an Approval event is emitted
      await expect(exa.approve(addr1.address, approveAmount))
        .to.emit(exa, "Approval")
        .withArgs(owner.address, addr1.address, approveAmount);
    });
    
    it("transfer() - Should fail when insufficient balance", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // addr1's initial balance (0 EXA)
      const addr1Balance = await exa.balanceOf(addr1.address);
      
      // Attempt to transfer more than the balance (1 EXA)
      const transferAmount = ethers.parseUnits("1", 18);
      
      // The transfer should fail
      await expect(
        exa.connect(addr1).transfer(owner.address, transferAmount)
      ).to.be.revertedWith("Insufficient balance");
    });
    
    it("transferFrom() - Should allow another account to transfer on behalf after approval", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // Amount to approve (200 EXA)
      const approveAmount = ethers.parseUnits("200", 18);
      
      // Grant addr1 permission to transfer owner's tokens
      await exa.approve(addr1.address, approveAmount);
      
      // Check allowance
      const allowance = await exa.allowance(owner.address, addr1.address);
      expect(allowance).to.equal(approveAmount);
      
      // Amount to transfer (150 EXA)
      const transferAmount = ethers.parseUnits("150", 18);
      
      // addr1 transfers owner's tokens to addr2
      await expect(
        exa.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.changeTokenBalances(
        exa, 
        [owner, addr2], 
        [transferAmount * BigInt(-1), transferAmount]
      );
      
      // Check remaining allowance
      const remainingAllowance = await exa.allowance(owner.address, addr1.address);
      expect(remainingAllowance).to.equal(approveAmount - transferAmount);
      
      // Check addr2's balance
      const addr2Balance = await exa.balanceOf(addr2.address);
    });
    
    it("increaseAllowance() - Should verify allowance increase functionality", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // Initial approval amount (100 EXA)
      const initialApproval = ethers.parseUnits("100", 18);
      await exa.approve(addr1.address, initialApproval);
      
      // Check initial allowance
      const initialAllowance = await exa.allowance(owner.address, addr1.address);
      
      // Increase allowance by 50 EXA
      const increaseAmount = ethers.parseUnits("50", 18);
      await exa.increaseAllowance(addr1.address, increaseAmount);
      
      // Check updated allowance
      const newAllowance = await exa.allowance(owner.address, addr1.address);
      
      expect(newAllowance).to.equal(initialAllowance + increaseAmount);
    });
    
    it("decreaseAllowance() - Should verify allowance decrease functionality", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // Initial approval amount (200 EXA)
      const initialApproval = ethers.parseUnits("200", 18);
      await exa.approve(addr1.address, initialApproval);
      
      // Check initial allowance
      const initialAllowance = await exa.allowance(owner.address, addr1.address);
      
      // Decrease allowance by 80 EXA
      const decreaseAmount = ethers.parseUnits("80", 18);
      await exa.decreaseAllowance(addr1.address, decreaseAmount);
      
      // Check updated allowance
      const newAllowance = await exa.allowance(owner.address, addr1.address);
      
      expect(newAllowance).to.equal(initialAllowance - decreaseAmount);
    });
  });

  // Add lockup functionality tests
  describe("Lockup Functionality Tests", function() {
    it("lock() - Should deduct tokens from balance and properly set lockup state", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // First transfer tokens to addr1
      const transferAmount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, transferAmount);
      
      // Check balance before lockup
      const initialBalance = await exa.balanceOf(addr1.address);
      
      // Get the current timestamp
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // Set lockup (start unlocking after 5 minutes, 10% every 1 minute)
      const lockupAmount = ethers.parseUnits("100", 18);
      const releaseStart = currentTimestamp + 300; // current + 5 minutes
      const termOfRound = 60; // 1 minute (60 seconds)
      const releaseRate = 10; // 10% each round
      
      // Execute lockup and check the event
      await expect(exa.lock(addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate))
        .to.emit(exa, "Lock")
        .withArgs(addr1.address, lockupAmount);
      
      // Check balance after lockup - balanceOf includes lockupInfo, so it should remain the same as before
      const balanceAfterLock = await exa.balanceOf(addr1.address);
      expect(balanceAfterLock).to.equal(initialBalance);
      
      // Check lockup state
      const lockState = await exa.showLockState(addr1.address, 0);
      
      // Verify
      expect(lockState[0]).to.be.true; // Lockup state should be true
      expect(lockState[1]).to.equal(1n); // The number of locks should be 1
      expect(lockState[2]).to.equal(lockupAmount); // The locked amount should be correct
      expect(lockState[3]).to.equal(BigInt(releaseStart)); // The start time of release should be correct
      expect(lockState[4]).to.equal(BigInt(termOfRound)); // The interval per round should be correct
      expect(lockState[5]).to.equal(lockupAmount * BigInt(releaseRate) / 100n); // The amount released each round should be correct (10%)
    });
    
    it("lock() - Should prevent transferring locked tokens before release time", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // Transfer tokens to addr1
      const transferAmount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, transferAmount);
      
      // Get the current timestamp
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // Set lockup (start unlocking after 5 minutes, 10% every 1 minute)
      const lockupAmount = ethers.parseUnits("500", 18);
      const releaseStart = currentTimestamp + 300; // current + 5 minutes
      const termOfRound = 60; // 1 minute (60 seconds)
      const releaseRate = 10; // 10% each round
      
      // Execute lockup
      await exa.lock(addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate);
      
      // Check balance
      const availableBalance = await exa.balanceOf(addr1.address);
      
      // Attempt to transfer 600 EXA which is more than available 500 EXA - should fail
      const tooMuchAmount = ethers.parseUnits("600", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, tooMuchAmount)
      ).to.be.revertedWith("Insufficient balance");
      
      // Attempt to transfer 400 EXA which is within the available 500 EXA - should succeed
      const transferPossibleAmount = ethers.parseUnits("400", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, transferPossibleAmount)
      ).to.changeTokenBalances(
        exa,
        [addr1, addr2],
        [transferPossibleAmount * BigInt(-1), transferPossibleAmount]
      );
      
      // Check the remaining balance
      const remainingBalance = await exa.balanceOf(addr1.address);
      expect(remainingBalance).to.equal(availableBalance - transferPossibleAmount);
    });
    
    it("autoUnlock() - Should automatically unlock tokens when the release time has passed", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // Transfer tokens to addr1
      const transferAmount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, transferAmount);
      
      // Get the current timestamp
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // Set lockup (start unlocking after 30 seconds, 10% every 10 seconds)
      const lockupAmount = ethers.parseUnits("100", 18);
      const releaseStart = currentTimestamp + 30; // current + 30 seconds
      const termOfRound = 10; // 10 seconds
      const releaseRate = 10; // 10% each round
      
      // Execute lockup
      await exa.lock(addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate);
      
      // Check balance after lockup - balanceOf includes lockupInfo, so it doesn't change
      const balanceAfterLock = await exa.balanceOf(addr1.address);
      expect(balanceAfterLock).to.equal(transferAmount);
      
      // Move forward in time to start release (30 seconds later)
      await time.increaseTo(releaseStart);
      
      // Check the first round release (10% unlocked)
      // Trigger autoUnlock by attempting a transfer
      const smallTransfer = ethers.parseUnits("1", 18);
      await exa.connect(addr1).transfer(addr2.address, smallTransfer);
      
      // Check balance after unlock - it should decrease by the smallTransfer amount
      const balanceAfterFirstRelease = await exa.balanceOf(addr1.address);
      
      // Expected: initial 1000 EXA - 1 EXA = 999 EXA
      const expectedFirstRelease = transferAmount - smallTransfer;
      expect(balanceAfterFirstRelease).to.equal(expectedFirstRelease);
      
      // Move forward to 3 more rounds (30 sec + 10 sec * 3 = 60 sec later)
      await time.increaseTo(releaseStart + 3 * termOfRound);
      
      // Trigger autoUnlock by attempting a transfer
      await exa.connect(addr1).transfer(addr2.address, smallTransfer);
      
      // Check balance at the start of the 4th round
      const balanceAfterFourthRound = await exa.balanceOf(addr1.address);
      
      // Expected: previous 999 EXA - 1 EXA = 998 EXA
      const expectedFourthRound = balanceAfterFirstRelease - smallTransfer;
      expect(balanceAfterFourthRound).to.equal(expectedFourthRound);
      
      // Move forward to the time when all locks are unlocked (30 sec + 10 sec*9 = 120 sec later)
      await time.increaseTo(releaseStart + 9 * termOfRound);
      
      // Trigger autoUnlock by attempting a transfer
      await exa.connect(addr1).transfer(addr2.address, smallTransfer);
      
      // Check the balance after all locks are released
      const balanceAfterFullRelease = await exa.balanceOf(addr1.address);
      
      // Expected: previous 998 EXA - 1 EXA = 997 EXA
      const expectedFullRelease = balanceAfterFourthRound - smallTransfer;
      expect(balanceAfterFullRelease).to.equal(expectedFullRelease);
      
      // Check lockup state (it should be false since all locks are released)
      const lockStateAfterFullRelease = await exa.showLockState(addr1.address, 0);
      
      // Since all locks are released, isLocked should be false
      expect(lockStateAfterFullRelease[0]).to.be.false;
    });
    
    it("distributeWithLockup() - Should distribute and lock tokens in a single transaction", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // Get the current timestamp
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // Set up distribution and lockup
      const distributeAmount = ethers.parseUnits("200", 18);
      const releaseStart = currentTimestamp + 60; // current + 1 minute
      const termOfRound = 20; // 20 seconds
      const releaseRate = 20; // 20% each round
      
      // Check balance before distribution
      const balanceBefore = await exa.balanceOf(addr1.address);
      
      // Execute distribution with lockup
      await exa.distributeWithLockup(addr1.address, distributeAmount, releaseStart, termOfRound, releaseRate);
      
      // Check balance after distribution
      const balanceAfter = await exa.balanceOf(addr1.address);
      
      // Check lockup state
      const lockState = await exa.showLockState(addr1.address, 0);
      
      // Verify
      expect(lockState[0]).to.be.true; // Lockup state should be true
      expect(lockState[2]).to.equal(distributeAmount); // The locked amount should be correct
      
      // Token transfers should be disallowed before the release time
      const transferAmount = ethers.parseUnits("10", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.be.revertedWith("Insufficient balance");
      
      // Move time past the release time
      await time.increaseTo(releaseStart + termOfRound);
      
      // Attempt to transfer within the released amount (20%)
      const releasedAmount = distributeAmount * BigInt(releaseRate) / 100n;
      
      // Transfer less than the released amount - should succeed
      const smallerAmount = releasedAmount - ethers.parseUnits("1", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, smallerAmount)
      ).to.changeTokenBalances(
        exa,
        [addr1, addr2],
        [smallerAmount * BigInt(-1), smallerAmount]
      );
    });
    
    it("unlock() - Should allow admin to manually unlock token lockups", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // Transfer tokens to addr1
      const transferAmount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, transferAmount);
      
      // Get the current timestamp
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // Set lockup (start unlocking after 5 minutes)
      const lockupAmount = ethers.parseUnits("500", 18);
      const releaseStart = currentTimestamp + 300; // current + 5 minutes
      const termOfRound = 60; // 1 minute intervals
      const releaseRate = 10; // 10% each round
      
      // Execute lockup
      await exa.lock(addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate);
      
      // Check the total balance right after lockup - balanceOf includes lockupInfo, so it doesn't change
      const balanceAfterLock = await exa.balanceOf(addr1.address);
      expect(balanceAfterLock).to.equal(transferAmount);
      
      // Check lockup state
      const lockStateBefore = await exa.showLockState(addr1.address, 0);
      
      // Admin manually unlocks
      await expect(exa.unlock(addr1.address, 0))
        .to.emit(exa, "Unlock")
        .withArgs(addr1.address, lockupAmount);
      
      // Check balance after manual unlock - no change
      const balanceAfterUnlock = await exa.balanceOf(addr1.address);
      expect(balanceAfterUnlock).to.equal(transferAmount);
      
      // Check lockup state after unlocking
      const lockStateAfter = await exa.showLockState(addr1.address, 0);
      
      // Verify
      expect(lockStateAfter[0]).to.be.false; // Should be false since the lockup is released
    });
  });
});
