import { 
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("EXAToken Basic Tests", function () {
  // 컨트랙트 배포 fixture
  async function deployTokenFixture() {
    // 계정 얻기
    const [owner, addr1, addr2] = await ethers.getSigners();

    // EXAToken 컨트랙트 팩토리 얻기
    const EXAToken = await ethers.getContractFactory("EXAToken");
    
    // EXAToken 배포
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
      
      // 기대값: 10억 * 10^18
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
      
      // 전송할 금액 (100 EXA)
      const transferAmount = ethers.parseUnits("100", 18);
      
      // 전송 전 잔액 확인
      const ownerBalanceBefore = await exa.balanceOf(owner.address);
      const addr1BalanceBefore = await exa.balanceOf(addr1.address);
      
      // owner에서 addr1로 토큰 전송
      await expect(
        exa.transfer(addr1.address, transferAmount)
      ).to.changeTokenBalances(
        exa, 
        [owner, addr1], 
        [transferAmount * BigInt(-1), transferAmount]
      );
      
      // 전송 후 잔액 확인
      const ownerBalanceAfter = await exa.balanceOf(owner.address);
      const addr1BalanceAfter = await exa.balanceOf(addr1.address);
      
      // 또 다른 계정으로 전송
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
      
      // 전송할 금액 (50 EXA)
      const transferAmount = ethers.parseUnits("50", 18);
      
      // Transfer 이벤트 발생 확인
      await expect(exa.transfer(addr1.address, transferAmount))
        .to.emit(exa, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);
    });
    
    it("transferFrom() - Should emit Transfer event when transferring tokens", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // 승인할 금액 (100 EXA)
      const approveAmount = ethers.parseUnits("100", 18);
      
      // addr1에게 owner 토큰 전송 권한 부여
      await exa.approve(addr1.address, approveAmount);
      
      // 전송할 금액 (75 EXA)
      const transferAmount = ethers.parseUnits("75", 18);
      
      // Transfer 이벤트 발생 확인
      await expect(exa.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount))
        .to.emit(exa, "Transfer")
        .withArgs(owner.address, addr2.address, transferAmount);
    });
    
    it("approve() - Should emit Approval event when approving", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 승인할 금액 (50 EXA)
      const approveAmount = ethers.parseUnits("50", 18);
      
      // Approval 이벤트 발생 확인
      await expect(exa.approve(addr1.address, approveAmount))
        .to.emit(exa, "Approval")
        .withArgs(owner.address, addr1.address, approveAmount);
    });
    
    it("transfer() - Should fail when insufficient balance", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // addr1의 초기 잔액 (0 EXA)
      const addr1Balance = await exa.balanceOf(addr1.address);
      
      // 잔액보다 많은 금액 전송 시도 (1 EXA)
      const transferAmount = ethers.parseUnits("1", 18);
      
      // 전송이 실패해야 함
      await expect(
        exa.connect(addr1).transfer(owner.address, transferAmount)
      ).to.be.revertedWith("Insufficient balance");
    });
    
    it("transferFrom() - Should allow another account to transfer on behalf after approval", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // 승인할 금액 (200 EXA)
      const approveAmount = ethers.parseUnits("200", 18);
      
      // addr1에게 owner 토큰 전송 권한 부여
      await exa.approve(addr1.address, approveAmount);
      
      // 권한 확인
      const allowance = await exa.allowance(owner.address, addr1.address);
      expect(allowance).to.equal(approveAmount);
      
      // 전송할 금액 (150 EXA)
      const transferAmount = ethers.parseUnits("150", 18);
      
      // addr1이 owner의 토큰을 addr2에게 전송
      await expect(
        exa.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.changeTokenBalances(
        exa, 
        [owner, addr2], 
        [transferAmount * BigInt(-1), transferAmount]
      );
      
      // 잔여 권한 확인
      const remainingAllowance = await exa.allowance(owner.address, addr1.address);
      expect(remainingAllowance).to.equal(approveAmount - transferAmount);
      
      // addr2 잔액 확인
      const addr2Balance = await exa.balanceOf(addr2.address);
    });
    
    it("increaseAllowance() - Should verify allowance increase functionality", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 초기 승인 금액 (100 EXA)
      const initialApproval = ethers.parseUnits("100", 18);
      await exa.approve(addr1.address, initialApproval);
      
      // 초기 권한 확인
      const initialAllowance = await exa.allowance(owner.address, addr1.address);
      
      // 권한 증가 (50 EXA 추가)
      const increaseAmount = ethers.parseUnits("50", 18);
      await exa.increaseAllowance(addr1.address, increaseAmount);
      
      // 증가된 권한 확인
      const newAllowance = await exa.allowance(owner.address, addr1.address);
      
      expect(newAllowance).to.equal(initialAllowance + increaseAmount);
    });
    
    it("decreaseAllowance() - Should verify allowance decrease functionality", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 초기 승인 금액 (200 EXA)
      const initialApproval = ethers.parseUnits("200", 18);
      await exa.approve(addr1.address, initialApproval);
      
      // 초기 권한 확인
      const initialAllowance = await exa.allowance(owner.address, addr1.address);
      
      // 권한 감소 (80 EXA 감소)
      const decreaseAmount = ethers.parseUnits("80", 18);
      await exa.decreaseAllowance(addr1.address, decreaseAmount);
      
      // 감소된 권한 확인
      const newAllowance = await exa.allowance(owner.address, addr1.address);
      
      expect(newAllowance).to.equal(initialAllowance - decreaseAmount);
    });
  });

  // 락업 기능 테스트 추가
  describe("Lockup Functionality Tests", function() {
    it("lock() - Should deduct tokens from balance and properly set lockup state", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // 먼저 addr1에게 토큰 전송
      const transferAmount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, transferAmount);
      
      // 락업 전 잔액 확인
      const initialBalance = await exa.balanceOf(addr1.address);
      
      // 현재 시간 가져오기
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // 락업 설정 (5분 후 해제 시작, 1분 간격으로 10%씩 해제)
      const lockupAmount = ethers.parseUnits("100", 18);
      const releaseStart = currentTimestamp + 300; // 현재 + 5분
      const termOfRound = 60; // 1분 (60초)
      const releaseRate = 10; // 10% 비율로 해제
      
      // 락업 실행 및 이벤트 확인
      await expect(exa.lock(addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate))
        .to.emit(exa, "Lock")
        .withArgs(addr1.address, lockupAmount);
      
      // 락업 후 잔액 확인 - balanceOf는 lockupInfo의 값을 포함하므로 락업 전과 같아야 함
      const balanceAfterLock = await exa.balanceOf(addr1.address);
      expect(balanceAfterLock).to.equal(initialBalance);
      
      // 락업 상태 확인
      const lockState = await exa.showLockState(addr1.address, 0);
      
      // 검증
      expect(lockState[0]).to.be.true; // 락업 상태가 true여야 함
      expect(lockState[1]).to.equal(1n); // 락업 개수가 1개여야 함
      expect(lockState[2]).to.equal(lockupAmount); // 락업된 금액이 맞아야 함
      expect(lockState[3]).to.equal(BigInt(releaseStart)); // 해제 시작 시간이 맞아야 함
      expect(lockState[4]).to.equal(BigInt(termOfRound)); // 라운드 간격이 맞아야 함
      expect(lockState[5]).to.equal(lockupAmount * BigInt(releaseRate) / 100n); // 라운드당 해제량이 맞아야 함 (10%)
    });
    
    it("lock() - Should prevent transferring locked tokens before release time", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // addr1에게 토큰 전송
      const transferAmount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, transferAmount);
      
      // 현재 시간 가져오기
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // 락업 설정 (5분 후 해제 시작, 1분 간격으로 10%씩 해제)
      const lockupAmount = ethers.parseUnits("500", 18);
      const releaseStart = currentTimestamp + 300; // 현재 + 5분
      const termOfRound = 60; // 1분 (60초)
      const releaseRate = 10; // 10% 비율로 해제
      
      // 락업 실행
      await exa.lock(addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate);
      
      // 잔액 확인
      const availableBalance = await exa.balanceOf(addr1.address);
      
      // 사용 가능한 잔액(500 EXA)보다 많은 양(600 EXA) 전송 시도 - 실패해야 함
      const tooMuchAmount = ethers.parseUnits("600", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, tooMuchAmount)
      ).to.be.revertedWith("Insufficient balance");
      
      // 사용 가능한 잔액(500 EXA) 이내의 양(400 EXA) 전송 시도 - 성공해야 함
      const transferPossibleAmount = ethers.parseUnits("400", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, transferPossibleAmount)
      ).to.changeTokenBalances(
        exa,
        [addr1, addr2],
        [transferPossibleAmount * BigInt(-1), transferPossibleAmount]
      );
      
      // 남은 잔액 확인
      const remainingBalance = await exa.balanceOf(addr1.address);
      expect(remainingBalance).to.equal(availableBalance - transferPossibleAmount);
    });
    
    it("autoUnlock() - Should automatically unlock tokens when the release time has passed", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // addr1에게 토큰 전송
      const transferAmount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, transferAmount);
      
      // 현재 시간 가져오기
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // 락업 설정 (30초 후 해제 시작, 10초 간격으로 10%씩 해제)
      const lockupAmount = ethers.parseUnits("100", 18);
      const releaseStart = currentTimestamp + 30; // 현재 + 30초
      const termOfRound = 10; // 10초 간격
      const releaseRate = 10; // 10% 비율로 해제
      
      // 락업 실행
      await exa.lock(addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate);
      
      // 락업 후 잔액 확인 - balanceOf는 lockupInfo의 값을 포함하므로 변동 없음
      const balanceAfterLock = await exa.balanceOf(addr1.address);
      expect(balanceAfterLock).to.equal(transferAmount);
      
      // 해제 시작 시간으로 시간 이동 (30초 후)
      await time.increaseTo(releaseStart);
      
      // 첫 라운드 해제 확인 (10% 해제)
      // 전송 시도하여 autoUnlock 트리거
      const smallTransfer = ethers.parseUnits("1", 18);
      await exa.connect(addr1).transfer(addr2.address, smallTransfer);
      
      // 해제 후 잔액 확인 - 전송한 smallTransfer만큼 감소해야 함
      const balanceAfterFirstRelease = await exa.balanceOf(addr1.address);
      
      // 기대값: 최초 잔액(1000 EXA) - 전송(1 EXA) = 999 EXA
      const expectedFirstRelease = transferAmount - smallTransfer;
      expect(balanceAfterFirstRelease).to.equal(expectedFirstRelease);
      
      // 추가로 3 라운드 후의 시간으로 이동 (30초 + 10초*3 = 60초 후)
      await time.increaseTo(releaseStart + 3 * termOfRound);
      
      // 전송 시도하여 autoUnlock 트리거
      await exa.connect(addr1).transfer(addr2.address, smallTransfer);
      
      // 4 라운드 시작 시간에 잔액 확인
      const balanceAfterFourthRound = await exa.balanceOf(addr1.address);
      
      // 기대값: 이전 잔액(999 EXA) - 전송(1 EXA) = 998 EXA
      const expectedFourthRound = balanceAfterFirstRelease - smallTransfer;
      expect(balanceAfterFourthRound).to.equal(expectedFourthRound);
      
      // 모든 락업이 해제되는 시간으로 이동 (30초 + 10초*9 = 120초 후)
      await time.increaseTo(releaseStart + 9 * termOfRound);
      
      // 전송 시도하여 autoUnlock 트리거
      await exa.connect(addr1).transfer(addr2.address, smallTransfer);
      
      // 모든 락업 해제 후 잔액 확인
      const balanceAfterFullRelease = await exa.balanceOf(addr1.address);
      
      // 기대값: 이전 잔액(998 EXA) - 전송(1 EXA) = 997 EXA
      const expectedFullRelease = balanceAfterFourthRound - smallTransfer;
      expect(balanceAfterFullRelease).to.equal(expectedFullRelease);
      
      // 락업 상태 확인 (락업이 모두 해제되었으므로 false여야 함)
      const lockStateAfterFullRelease = await exa.showLockState(addr1.address, 0);
      
      // 모든 락업이 해제되었으므로 isLocked가 false여야 함
      expect(lockStateAfterFullRelease[0]).to.be.false;
    });
    
    it("distributeWithLockup() - Should distribute and lock tokens in a single transaction", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // 현재 시간 가져오기
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // 배포 및 락업 설정
      const distributeAmount = ethers.parseUnits("200", 18);
      const releaseStart = currentTimestamp + 60; // 현재 + 1분
      const termOfRound = 20; // 20초 간격
      const releaseRate = 20; // 20% 비율로 해제
      
      // 배포 전 잔액 확인
      const balanceBefore = await exa.balanceOf(addr1.address);
      
      // 배포 및 락업 실행
      await exa.distributeWithLockup(addr1.address, distributeAmount, releaseStart, termOfRound, releaseRate);
      
      // 배포 후 잔액 확인
      const balanceAfter = await exa.balanceOf(addr1.address);
      
      // 락업 상태 확인
      const lockState = await exa.showLockState(addr1.address, 0);
      
      // 검증
      expect(lockState[0]).to.be.true; // 락업 상태가 true여야 함
      expect(lockState[2]).to.equal(distributeAmount); // 락업된 금액이 맞아야 함
      
      // 해제 시간 이전에는 토큰 전송이 불가능해야 함
      const transferAmount = ethers.parseUnits("10", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.be.revertedWith("Insufficient balance");
      
      // 해제 시간 이후로 이동
      await time.increaseTo(releaseStart + termOfRound);
      
      // 해제된 양(20%) 이내에서 전송 시도
      const releasedAmount = distributeAmount * BigInt(releaseRate) / 100n;
      
      // 해제된 양보다 작은 금액 전송 - 성공해야 함
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
      
      // addr1에게 토큰 전송
      const transferAmount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, transferAmount);
      
      // 현재 시간 가져오기
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore!.timestamp;
      
      // 락업 설정 (5분 후 해제 시작)
      const lockupAmount = ethers.parseUnits("500", 18);
      const releaseStart = currentTimestamp + 300; // 현재 + 5분
      const termOfRound = 60; // 1분 간격
      const releaseRate = 10; // 10% 비율로 해제
      
      // 락업 실행
      await exa.lock(addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate);
      
      // 락업 직후 총 잔액 확인 - balanceOf는 lockupInfo의 값을 포함하므로 변동 없음
      const balanceAfterLock = await exa.balanceOf(addr1.address);
      expect(balanceAfterLock).to.equal(transferAmount);
      
      // 락업 상태 확인
      const lockStateBefore = await exa.showLockState(addr1.address, 0);
      
      // 관리자가 수동으로 락업 해제
      await expect(exa.unlock(addr1.address, 0))
        .to.emit(exa, "Unlock")
        .withArgs(addr1.address, lockupAmount);
      
      // 수동 해제 후 잔액 확인 - 변동 없음
      const balanceAfterUnlock = await exa.balanceOf(addr1.address);
      expect(balanceAfterUnlock).to.equal(transferAmount);
      
      // 해제 후 락업 상태 확인
      const lockStateAfter = await exa.showLockState(addr1.address, 0);
      
      // 검증
      expect(lockStateAfter[0]).to.be.false; // 락업이 해제되었으므로 false여야 함
    });
  });
}); 