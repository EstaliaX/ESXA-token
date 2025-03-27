import { 
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("EXAToken Unlock Functionality Tests", function () {
  // 컨트랙트 배포 fixture
  async function deployTokenFixture() {
    // 계정 얻기
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
    // EXAToken 컨트랙트 배포
    const EXAToken = await ethers.getContractFactory("EXAToken");
    const exa = await EXAToken.deploy();
    
    return { exa, owner, addr1, addr2, addr3 };
  }

  // 락업 설정을 위한 Helper 함수
  async function setupLockup(
    exa: any, 
    owner: any, 
    targetAddress: string, 
    amount: bigint, 
    releaseStart: number, 
    termOfRound: number, 
    releaseRate: number
  ) {
    // 토큰 전송
    if(targetAddress != owner.address) {
      await exa.transfer(targetAddress, amount);
    }
    
    // 락업 설정
    await exa.lock(targetAddress, amount, releaseStart, termOfRound, releaseRate);
    
    return await exa.showLockState(targetAddress, 0);
  }

  describe("Basic Unlock Functionality Tests", function() {
    it("unlock() - Should properly unlock tokens from a locked account", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 테스트를 위한 데이터
      const lockupAmount = ethers.parseUnits("100", 18);
      const currentTime = await time.latest();
      const releaseStart = currentTime + 300; // 5분 후
      const termOfRound = 60; // 1분
      const releaseRate = 10; // 10%
      
      // 락업 설정
      await setupLockup(exa, owner, addr1.address, lockupAmount, releaseStart, termOfRound, releaseRate);
      
      // 언락 전 상태 확인
      const balanceBeforeUnlock = await exa.balanceOf(addr1.address);
      const availableBeforeUnlock = balanceBeforeUnlock - lockupAmount; // 실제 사용 가능한 잔액
      
      // 언락 실행 및 이벤트 확인
      await expect(exa.unlock(addr1.address, 0))
        .to.emit(exa, "Unlock")
        .withArgs(addr1.address, lockupAmount);
      
      // 언락 후 상태 확인
      const balanceAfterUnlock = await exa.balanceOf(addr1.address);
      
      // 락업 상태 확인
      const lockState = await exa.showLockState(addr1.address, 0);
      
      // 검증
      expect(lockState[0]).to.be.false; // 락업 상태가 false여야 함
      expect(lockState[1]).to.equal(0n); // 락업 개수가 0개여야 함
      expect(balanceAfterUnlock).to.equal(balanceBeforeUnlock); // 총 잔액은 변함 없음
    });
    
    it("unlock() - Available balance should increase after unlock", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // 테스트를 위한 데이터
      const initialTransfer = ethers.parseUnits("1000", 18);
      const lockupAmount = ethers.parseUnits("500", 18);
      const currentTime = await time.latest();
      const releaseStart = currentTime + 300; // 5분 후
      
      // 초기 토큰 전송
      await exa.transfer(addr1.address, initialTransfer);
      
      // 락업 설정
      await exa.lock(addr1.address, lockupAmount, releaseStart, 60, 10);
      
      // 락업 후 사용 가능한 잔액 확인
      const transferBeforeUnlock = ethers.parseUnits("400", 18); // 사용 가능한 500 EXA 중 400 EXA 전송
      await exa.connect(addr1).transfer(addr2.address, transferBeforeUnlock);
      
      // 사용 가능한 잔액(100 EXA)보다 많은 양(200 EXA) 전송 시도 - 실패해야 함
      const tooMuchAmount = ethers.parseUnits("200", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, tooMuchAmount)
      ).to.be.revertedWith("Insufficient balance");
      
      // 언락 실행
      await exa.unlock(addr1.address, 0);
      
      // 언락 후 사용 가능한 잔액 확인 (500 EXA 해제되어 총 600 EXA 사용 가능)
      const transferAfterUnlock = ethers.parseUnits("600", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, transferAfterUnlock)
      ).to.changeTokenBalances(
        exa,
        [addr1, addr2],
        [transferAfterUnlock * BigInt(-1), transferAfterUnlock]
      );
    });
  });

  describe("Unlock Permission and Exception Tests", function() {
    it("unlock() - Only owner should be able to unlock", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // 락업 설정
      const lockupAmount = ethers.parseUnits("100", 18);
      const currentTime = await time.latest();
      await setupLockup(exa, owner, addr1.address, lockupAmount, currentTime + 300, 60, 10);
      
      // 비소유자가 언락 시도 - 실패해야 함
      await expect(
        exa.connect(addr1).unlock(addr1.address, 0)
      ).to.be.revertedWithCustomError(exa, "OwnableUnauthorizedAccount");
      
      // 소유자가 언락 시도 - 성공해야 함
      await expect(
        exa.unlock(addr1.address, 0)
      ).to.emit(exa, "Unlock");
    });
    
    it("unlock() - Should fail when attempting to unlock an account that is not locked", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // 락업 없이 언락 시도 - 실패해야 함
      await expect(
        exa.unlock(addr1.address, 0)
      ).to.be.revertedWith("Account not locked");
    });
    
    it("unlock() - Should fail when attempting to unlock with an invalid index", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 락업 설정
      const lockupAmount = ethers.parseUnits("100", 18);
      const currentTime = await time.latest();
      await setupLockup(exa, owner, addr1.address, lockupAmount, currentTime + 300, 60, 10);
      
      // 유효하지 않은 인덱스로 언락 시도 - 실패해야 함
      await expect(
        exa.unlock(addr1.address, 1)
      ).to.be.revertedWith("Invalid lockup index");
    });
  });

  describe("Complex Unlock Scenario Tests", function() {
    it("unlock() - Should unlock only the specific index when multiple lockups exist", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 초기 토큰 전송
      const initialTransfer = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, initialTransfer);
      
      // 여러 개의 락업 설정
      const currentTime = await time.latest();
      const lockupAmount1 = ethers.parseUnits("200", 18);
      const lockupAmount2 = ethers.parseUnits("300", 18);
      const lockupAmount3 = ethers.parseUnits("100", 18);
      
      await exa.lock(addr1.address, lockupAmount1, currentTime + 300, 60, 10);
      await exa.lock(addr1.address, lockupAmount2, currentTime + 600, 60, 20);
      await exa.lock(addr1.address, lockupAmount3, currentTime + 900, 60, 30);
      
      // 락업 상태 확인
      const lockedState = await exa.showLockState(addr1.address, 0);
      expect(lockedState[1]).to.equal(3n); // 락업 개수가 3개여야 함
      
      // 두 번째 락업(인덱스 1) 언락
      await exa.unlock(addr1.address, 1);
      
      // 언락 후 상태 확인
      const afterFirstUnlock = await exa.showLockState(addr1.address, 0);
      expect(afterFirstUnlock[1]).to.equal(2n); // 락업 개수가 2개여야 함
      expect(afterFirstUnlock[0]).to.be.true; // 아직 락업 상태여야 함
      
      // 인덱스 0의 락업 금액 확인 (인덱스 2가 인덱스 1로 이동했을 수 있음)
      const firstLockup = await exa.showLockState(addr1.address, 0);
      
      // 인덱스 1의 락업 금액 확인
      const secondLockup = await exa.showLockState(addr1.address, 1);
      
      // 두 락업 금액의 합은 lockupAmount1 + lockupAmount3 여야 함
      const totalLockedAmount = firstLockup[2] + secondLockup[2];
      expect(totalLockedAmount).to.equal(lockupAmount1 + lockupAmount3);
    });
    
    it("unlock() - The locks state should change to false when the last lockup is unlocked", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 초기 토큰 전송
      const initialTransfer = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, initialTransfer);
      
      // 여러 개의 락업 설정
      const currentTime = await time.latest();
      const lockupAmount1 = ethers.parseUnits("200", 18);
      const lockupAmount2 = ethers.parseUnits("300", 18);
      
      await exa.lock(addr1.address, lockupAmount1, currentTime + 300, 60, 10);
      await exa.lock(addr1.address, lockupAmount2, currentTime + 600, 60, 20);
      
      // 첫 번째 락업 언락
      await exa.unlock(addr1.address, 0);
      
      // 첫 번째 언락 후 상태 확인
      const afterFirstUnlock = await exa.showLockState(addr1.address, 0);
      expect(afterFirstUnlock[0]).to.be.true; // 아직 락업 상태여야 함
      expect(afterFirstUnlock[1]).to.equal(1n); // 락업 개수가 1개여야 함
      
      // 두 번째(마지막) 락업 언락
      await exa.unlock(addr1.address, 0);
      
      // 모든 락업 해제 후 상태 확인
      const afterAllUnlock = await exa.showLockState(addr1.address, 0);
      expect(afterAllUnlock[0]).to.be.false; // 모든 락업이 해제되어 false여야 함
      expect(afterAllUnlock[1]).to.equal(0n); // 락업 개수가 0개여야 함
    });
    
    it("unlock() - Should verify transfer capability after unlock", async function() {
      const { exa, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // 초기 토큰 전송
      const initialTransfer = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, initialTransfer);
      
      // 전액 락업 설정
      const currentTime = await time.latest();
      await exa.lock(addr1.address, initialTransfer, currentTime + 300, 60, 10);
      
      // 락업 상태에서 전송 시도 - 실패해야 함
      const transferAmount = ethers.parseUnits("10", 18);
      await expect(
        exa.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.be.revertedWith("Insufficient balance");
      
      // 전액 언락
      await exa.unlock(addr1.address, 0);
      
      // 언락 후 전송 시도 - 성공해야 함
      await expect(
        exa.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.changeTokenBalances(
        exa,
        [addr1, addr2],
        [transferAmount * BigInt(-1), transferAmount]
      );
    });
  });

  describe("Edge Case and Special Scenario Tests", function() {
    it("unlock() - Locks state should be correctly updated when unlocking the last lockup from a non-zero index", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 초기 토큰 전송
      const initialTransfer = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, initialTransfer);
      
      // 여러 개의 락업 설정
      const currentTime = await time.latest();
      const lockupAmount1 = ethers.parseUnits("200", 18);
      const lockupAmount2 = ethers.parseUnits("300", 18);
      const lockupAmount3 = ethers.parseUnits("100", 18);
      
      await exa.lock(addr1.address, lockupAmount1, currentTime + 300, 60, 10);
      await exa.lock(addr1.address, lockupAmount2, currentTime + 600, 60, 20);
      await exa.lock(addr1.address, lockupAmount3, currentTime + 900, 60, 30);
      
      // 인덱스 0과 2를 언락 (1이 남음)
      await exa.unlock(addr1.address, 0);
      await exa.unlock(addr1.address, 1); // 인덱스 2가 1로 이동했을 것임
      
      // 마지막 락업 언락
      await exa.unlock(addr1.address, 0);
      
      // 락업 상태 확인
      const lockState = await exa.showLockState(addr1.address, 0);
      expect(lockState[0]).to.be.false; // 락업 상태가 false여야 함
    });
    
    it("unlock() - Multiple accounts' lockups and unlocks should work independently", async function() {
      const { exa, owner, addr1, addr2, addr3 } = await loadFixture(deployTokenFixture);
      
      // 초기 토큰 전송
      const amount = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, amount);
      await exa.transfer(addr2.address, amount);
      await exa.transfer(addr3.address, amount);
      
      // 각 계정에 다르게 락업 설정
      const currentTime = await time.latest();
      const lockAmount1 = ethers.parseUnits("500", 18);
      const lockAmount2 = ethers.parseUnits("800", 18);
      const lockAmount3 = ethers.parseUnits("600", 18);
      
      await exa.lock(addr1.address, lockAmount1, currentTime + 300, 60, 10);
      await exa.lock(addr2.address, lockAmount2, currentTime + 300, 60, 10);
      await exa.lock(addr3.address, lockAmount3, currentTime + 300, 60, 10);
      
      // addr1의 락업만 해제
      await exa.unlock(addr1.address, 0);
      
      // 각 계정의 락업 상태 확인
      const lock1 = await exa.showLockState(addr1.address, 0);
      const lock2 = await exa.showLockState(addr2.address, 0);
      const lock3 = await exa.showLockState(addr3.address, 0);
      
      expect(lock1[0]).to.be.false; // addr1은 락업 해제되어야 함
      expect(lock2[0]).to.be.true; // addr2는 여전히 락업 상태여야 함
      expect(lock3[0]).to.be.true; // addr3도 여전히 락업 상태여야 함
      
      // addr1은 전액 전송 가능해야 함
      await expect(
        exa.connect(addr1).transfer(owner.address, ethers.parseUnits("1000", 18))
      ).to.changeTokenBalances(
        exa,
        [addr1, owner],
        [ethers.parseUnits("-1000", 18), ethers.parseUnits("1000", 18)]
      );
      
      // addr2는 제한된 금액만 전송 가능해야 함
      // addr2의 사용 가능한 잔액: 1000 - 800 = 200 EXA
      await expect(
        exa.connect(addr2).transfer(owner.address, ethers.parseUnits("150", 18))
      ).to.not.be.reverted;
      
      // 남은 사용 가능한 잔액: 200 - 150 = 50 EXA
      // 여기서 100 EXA 전송 시도 시 실패해야 함
      await expect(
        exa.connect(addr2).transfer(owner.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("Insufficient balance");
    });
    
    it("unlock() - Should be able to lock again after being completely unlocked", async function() {
      const { exa, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // 초기 토큰 전송
      const initialTransfer = ethers.parseUnits("1000", 18);
      await exa.transfer(addr1.address, initialTransfer);
      
      // 1차 락업 및 해제
      const currentTime = await time.latest();
      const lockupAmount1 = ethers.parseUnits("500", 18);
      
      await exa.lock(addr1.address, lockupAmount1, currentTime + 300, 60, 10);
      await exa.unlock(addr1.address, 0);
      
      // 언락 후 상태 확인
      const lockStateAfterUnlock = await exa.showLockState(addr1.address, 0);
      expect(lockStateAfterUnlock[0]).to.be.false;
      
      // 2차 락업
      const lockupAmount2 = ethers.parseUnits("700", 18);
      await exa.lock(addr1.address, lockupAmount2, currentTime + 600, 60, 20);
      
      // 2차 락업 후 상태 확인
      const lockStateAfterSecondLock = await exa.showLockState(addr1.address, 0);
      expect(lockStateAfterSecondLock[0]).to.be.true;
      expect(lockStateAfterSecondLock[2]).to.equal(lockupAmount2);
    });
  });
}); 