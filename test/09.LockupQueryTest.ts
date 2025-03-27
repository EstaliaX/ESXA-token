import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("EXAToken Lockup Information Query Tests", function () {
  let exaToken: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addr3: any;
  let ownerAddress: string;
  let addr1Address: string;
  let addr2Address: string;
  let addr3Address: string;

  beforeEach(async function () {
    // 계정 설정
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    addr1Address = await addr1.getAddress();
    addr2Address = await addr2.getAddress();
    addr3Address = await addr3.getAddress();

    // EXAToken 배포
    const EXAToken = await ethers.getContractFactory("EXAToken");
    exaToken = await EXAToken.deploy();
    
    // 테스트용 토큰 전송
    await exaToken.transfer(addr1Address, ethers.parseEther("10000")); // 10,000 토큰
    await exaToken.transfer(addr2Address, ethers.parseEther("20000")); // 20,000 토큰
    await exaToken.transfer(addr3Address, ethers.parseEther("30000")); // 30,000 토큰
  });

  describe("Basic Lockup Information Query Tests", function () {
    it("Accounts without lockup should have empty lockup information", async function () {
      // 락업 상태 조회
      const [isLocked, lockupCount, lockupBalance, releaseTime, termOfRound, unlockAmountPerRound] = 
        await exaToken.showLockState(addr1Address, 0);
      
      // 검증
      expect(isLocked).to.be.false;
      expect(lockupCount).to.equal(0);
      expect(lockupBalance).to.equal(0);
      expect(releaseTime).to.equal(0);
      expect(termOfRound).to.equal(0);
      expect(unlockAmountPerRound).to.equal(0);
    });

    it("Should display accurate information when querying after a single lockup", async function () {
      // 현재 시간 기준 1시간 후 릴리즈
      const currentTime = await time.latest();
      const releaseStart = currentTime + 3600; // 1시간 후
      const termOfRound = 86400; // 1일
      const releaseRate = 10; // 10%
      const lockAmount = ethers.parseEther("5000"); // 5,000 토큰
      
      // 락업 설정
      await exaToken.lock(addr1Address, lockAmount, releaseStart, termOfRound, releaseRate);
      
      // 락업 상태 조회
      const [isLocked, lockupCount, lockupBalance, actualReleaseTime, actualTermOfRound, unlockAmountPerRound] = 
        await exaToken.showLockState(addr1Address, 0);
      
      // 검증
      expect(isLocked).to.be.true;
      expect(lockupCount).to.equal(1);
      expect(lockupBalance).to.equal(lockAmount);
      expect(actualReleaseTime).to.equal(releaseStart);
      expect(actualTermOfRound).to.equal(termOfRound);
      // 10% 릴리즈 비율 확인
      expect(unlockAmountPerRound).to.equal(lockAmount * BigInt(releaseRate) / BigInt(100));
    });
  });

  describe("Multiple Lockup Information Query Tests", function () {
    it("Should correctly query each lockup condition after setting multiple lockups", async function () {
      // 현재 시간 기준 다양한 릴리즈 시간
      const currentTime = await time.latest();
      
      // 첫 번째 락업: 1시간 후 시작, 1일 주기, 10% 비율
      const releaseStart1 = currentTime + 3600; // 1시간 후
      const termOfRound1 = 86400; // 1일
      const releaseRate1 = 10; // 10%
      const lockAmount1 = ethers.parseEther("2000"); // 2,000 토큰
      
      // 두 번째 락업: 2일 후 시작, 1주일 주기, 20% 비율
      const releaseStart2 = currentTime + 172800; // 2일 후
      const termOfRound2 = 604800; // 1주일
      const releaseRate2 = 20; // 20%
      const lockAmount2 = ethers.parseEther("3000"); // 3,000 토큰
      
      // 세 번째 락업: 1개월 후 시작, 1개월 주기, 25% 비율
      const releaseStart3 = currentTime + 2592000; // 30일 후
      const termOfRound3 = 2592000; // 30일
      const releaseRate3 = 25; // 25%
      const lockAmount3 = ethers.parseEther("4000"); // 4,000 토큰
      
      // 락업 설정
      await exaToken.lock(addr2Address, lockAmount1, releaseStart1, termOfRound1, releaseRate1);
      await exaToken.lock(addr2Address, lockAmount2, releaseStart2, termOfRound2, releaseRate2);
      await exaToken.lock(addr2Address, lockAmount3, releaseStart3, termOfRound3, releaseRate3);
      
      // 락업 총 개수 확인 (락업 상태와 개수만 조회)
      const [isLocked, lockupCount] = await exaToken.showLockState(addr2Address, 0);
      expect(isLocked).to.be.true;
      expect(lockupCount).to.equal(3);
      
      // 첫 번째 락업 조회
      const [, , lockupBalance1, actualReleaseTime1, actualTermOfRound1, unlockAmountPerRound1] = 
        await exaToken.showLockState(addr2Address, 0);
      
      expect(lockupBalance1).to.equal(lockAmount1);
      expect(actualReleaseTime1).to.equal(releaseStart1);
      expect(actualTermOfRound1).to.equal(termOfRound1);
      expect(unlockAmountPerRound1).to.equal(lockAmount1 * BigInt(releaseRate1) / BigInt(100));
      
      // 두 번째 락업 조회
      const [, , lockupBalance2, actualReleaseTime2, actualTermOfRound2, unlockAmountPerRound2] = 
        await exaToken.showLockState(addr2Address, 1);
      
      expect(lockupBalance2).to.equal(lockAmount2);
      expect(actualReleaseTime2).to.equal(releaseStart2);
      expect(actualTermOfRound2).to.equal(termOfRound2);
      expect(unlockAmountPerRound2).to.equal(lockAmount2 * BigInt(releaseRate2) / BigInt(100));
      
      // 세 번째 락업 조회
      const [, , lockupBalance3, actualReleaseTime3, actualTermOfRound3, unlockAmountPerRound3] = 
        await exaToken.showLockState(addr2Address, 2);
      
      expect(lockupBalance3).to.equal(lockAmount3);
      expect(actualReleaseTime3).to.equal(releaseStart3);
      expect(actualTermOfRound3).to.equal(termOfRound3);
      expect(unlockAmountPerRound3).to.equal(lockAmount3 * BigInt(releaseRate3) / BigInt(100));
    });

    it("Remaining lockups should be correctly queried after unlocking a specific lockup", async function () {
      // 현재 시간 기준
      const currentTime = await time.latest();
      
      // 3개의 락업 설정
      const lockAmount1 = ethers.parseEther("1000");
      const lockAmount2 = ethers.parseEther("2000");
      const lockAmount3 = ethers.parseEther("3000");
      
      await exaToken.lock(addr3Address, lockAmount1, currentTime + 3600, 86400, 10);
      await exaToken.lock(addr3Address, lockAmount2, currentTime + 7200, 86400, 20);
      await exaToken.lock(addr3Address, lockAmount3, currentTime + 10800, 86400, 30);
      
      // 초기 락업 개수 확인
      const [isLockedBefore, lockupCountBefore] = await exaToken.showLockState(addr3Address, 0);
      expect(isLockedBefore).to.be.true;
      expect(lockupCountBefore).to.equal(3);
      
      // 중간 락업(인덱스 1) 해제
      await exaToken.unlock(addr3Address, 1);
      
      // 락업 해제 후 개수 확인
      const [isLockedAfter, lockupCountAfter] = await exaToken.showLockState(addr3Address, 0);
      expect(isLockedAfter).to.be.true;
      expect(lockupCountAfter).to.equal(2);
      
      // 남은 락업 정보 확인 (원래 인덱스 2가 인덱스 1로 이동함)
      // 첫 번째 락업 (원래 인덱스 0)
      const [, , lockupBalance1, releaseTime1, , ] = await exaToken.showLockState(addr3Address, 0);
      expect(lockupBalance1).to.equal(lockAmount1);
      
      // 두 번째 락업 (원래 인덱스 2가 인덱스 1로 이동)
      const [, , lockupBalance2, releaseTime2, , ] = await exaToken.showLockState(addr3Address, 1);
      expect(lockupBalance2).to.equal(lockAmount3); // 원래 인덱스 2의 잠금 금액
    });
  });

  describe("Special Case Lockup Information Query Tests", function () {
    it("Accurate information should be displayed when release rate is 100%", async function () {
      // 현재 시간 기준 1시간 후 릴리즈
      const currentTime = await time.latest();
      const releaseStart = currentTime + 3600; // 1시간 후
      const termOfRound = 1; // 1초 (즉시 해제 시뮬레이션)
      const releaseRate = 100; // 100% (전체 해제)
      const lockAmount = ethers.parseEther("5000"); // 5,000 토큰
      
      // 락업 설정
      await exaToken.lock(addr1Address, lockAmount, releaseStart, termOfRound, releaseRate);
      
      // 락업 상태 조회
      const [isLocked, lockupCount, lockupBalance, actualReleaseTime, actualTermOfRound, unlockAmountPerRound] = 
        await exaToken.showLockState(addr1Address, 0);
      
      // 검증
      expect(isLocked).to.be.true;
      expect(lockupCount).to.equal(1);
      expect(lockupBalance).to.equal(lockAmount);
      expect(actualReleaseTime).to.equal(releaseStart);
      expect(actualTermOfRound).to.equal(termOfRound);
      // 100% 릴리즈 비율 확인 - 전체 금액이 한 번에 해제됨
      expect(unlockAmountPerRound).to.equal(lockAmount);
    });

    it("Lockup state should change to false after all lockups are released", async function () {
      // 현재 시간
      const currentTime = await time.latest();
      const releaseStart = currentTime + 1; // 1초 후 (바로 테스트 가능하도록)
      const termOfRound = 1; // 1초
      const releaseRate = 100; // 100%
      const lockAmount = ethers.parseEther("1000"); // 1,000 토큰
      
      // 락업 설정
      await exaToken.lock(addr1Address, lockAmount, releaseStart, termOfRound, releaseRate);
      
      // 락업 설정 직후 확인
      const [isLockedBefore] = await exaToken.showLockState(addr1Address, 0);
      expect(isLockedBefore).to.be.true;
      
      // 시간 1.5초 경과 시킴
      await time.increase(2);
      
      // 잠금 해제 트리거를 위해 transfer 호출
      await exaToken.connect(addr1).transfer(addr2Address, ethers.parseEther("1"));
      
      // 모든 락업이 해제된 후 상태 확인
      const [isLockedAfter, lockupCountAfter] = await exaToken.showLockState(addr1Address, 0);
      
      // 검증
      expect(isLockedAfter).to.be.false;
      expect(lockupCountAfter).to.equal(0);
    });

    it("Lockups for multiple accounts should be correctly queried for each account", async function () {
      // 현재 시간
      const currentTime = await time.latest();
      
      // 여러 계정에 락업 설정
      // 계정 1: 1시간 후 시작, 10% 비율
      await exaToken.lock(addr1Address, ethers.parseEther("1000"), currentTime + 3600, 86400, 10);
      
      // 계정 2: 2시간 후 시작, 20% 비율
      await exaToken.lock(addr2Address, ethers.parseEther("2000"), currentTime + 7200, 86400, 20);
      
      // 계정 3: 3시간 후 시작, 30% 비율
      await exaToken.lock(addr3Address, ethers.parseEther("3000"), currentTime + 10800, 86400, 30);
      
      // 각 계정별 락업 상태 확인
      const [isLocked1, , lockupBalance1, , , unlockAmountPerRound1] = await exaToken.showLockState(addr1Address, 0);
      const [isLocked2, , lockupBalance2, , , unlockAmountPerRound2] = await exaToken.showLockState(addr2Address, 0);
      const [isLocked3, , lockupBalance3, , , unlockAmountPerRound3] = await exaToken.showLockState(addr3Address, 0);
      
      // 검증
      expect(isLocked1).to.be.true;
      expect(isLocked2).to.be.true;
      expect(isLocked3).to.be.true;
      
      expect(lockupBalance1).to.equal(ethers.parseEther("1000"));
      expect(lockupBalance2).to.equal(ethers.parseEther("2000"));
      expect(lockupBalance3).to.equal(ethers.parseEther("3000"));
      
      expect(unlockAmountPerRound1).to.equal(ethers.parseEther("100")); // 10%
      expect(unlockAmountPerRound2).to.equal(ethers.parseEther("400")); // 20%
      expect(unlockAmountPerRound3).to.equal(ethers.parseEther("900")); // 30%
    });
  });
}); 