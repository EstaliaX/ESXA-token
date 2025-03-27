import { expect } from "chai";
import { ethers } from "hardhat";

describe("EXAToken Balance and Supply Tests", function () {
  let exaToken: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let ownerAddress: string;
  let addr1Address: string;
  let addr2Address: string;
  let initialSupply: bigint;

  beforeEach(async function () {
    // 계정 설정
    [owner, addr1, addr2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    addr1Address = await addr1.getAddress();
    addr2Address = await addr2.getAddress();

    // EXAToken 배포
    const EXAToken = await ethers.getContractFactory("EXAToken");
    exaToken = await EXAToken.deploy();
    
    // 초기 공급량 저장 (10억 토큰)
    initialSupply = BigInt(1) * BigInt(10**9) * BigInt(10**18);
  });

  describe("Total Supply Tests", function () {
    it("Token total supply should be accurate after contract deployment", async function () {
      // 총 공급량 조회
      const totalSupply = await exaToken.totalSupply();
      
      // 예상 총 공급량: 1,000,000,000 * 10^18 (1B tokens with 18 decimals)
      const expectedTotalSupply = initialSupply;
      
      // 검증
      expect(totalSupply).to.equal(expectedTotalSupply);
    });

    it("Total supply should decrease after burning tokens", async function () {
      // 소각할 금액
      const burnAmount = ethers.parseEther("1000");
      
      // 소각 전 총 공급량 저장
      const beforeTotalSupply = await exaToken.totalSupply();
      
      // 소각 실행
      await exaToken.burn(burnAmount);
      
      // 소각 후 총 공급량 조회
      const afterTotalSupply = await exaToken.totalSupply();
      
      // 검증
      expect(afterTotalSupply).to.equal(beforeTotalSupply - burnAmount);
    });

    it("Total supply should not change due to transfers", async function () {
      // 전송 전 총 공급량 저장
      const beforeTotalSupply = await exaToken.totalSupply();
      
      // 토큰 전송
      const transferAmount = ethers.parseEther("1000");
      await exaToken.transfer(addr1Address, transferAmount);
      
      // 전송 후 총 공급량 조회
      const afterTotalSupply = await exaToken.totalSupply();
      
      // 검증
      expect(afterTotalSupply).to.equal(beforeTotalSupply);
    });
  });

  describe("Wallet Balance (balanceOf) Tests", function () {
    it("Initial balance of owner should be equal to total supply", async function () {
      // 배포자 잔고 조회
      const ownerBalance = await exaToken.balanceOf(ownerAddress);
      
      // 총 공급량 조회
      const totalSupply = await exaToken.totalSupply();
      
      // 검증
      expect(ownerBalance).to.equal(totalSupply);
    });

    it("Balance of recipient address should be correctly reflected after transfer", async function () {
      // 전송 전 수신자 잔고 확인
      const initialReceiverBalance = await exaToken.balanceOf(addr1Address);
      expect(initialReceiverBalance).to.equal(0);
      
      // 토큰 전송
      const transferAmount = ethers.parseEther("500");
      await exaToken.transfer(addr1Address, transferAmount);
      
      // 전송 후 수신자 잔고 확인
      const finalReceiverBalance = await exaToken.balanceOf(addr1Address);
      
      // 검증
      expect(finalReceiverBalance).to.equal(transferAmount);
    });

    it("Balance of sender address should be correctly deducted after transfer", async function () {
      // 전송 전 발신자(owner) 잔고 확인
      const initialSenderBalance = await exaToken.balanceOf(ownerAddress);
      
      // 토큰 전송
      const transferAmount = ethers.parseEther("1000");
      await exaToken.transfer(addr1Address, transferAmount);
      
      // 전송 후 발신자 잔고 확인
      const finalSenderBalance = await exaToken.balanceOf(ownerAddress);
      
      // 검증
      expect(finalSenderBalance).to.equal(initialSenderBalance - transferAmount);
    });

    it("Sum of all address balances should match total supply after multiple transfers", async function () {
      // 여러 주소로 토큰 전송
      await exaToken.transfer(addr1Address, ethers.parseEther("1000"));
      await exaToken.transfer(addr2Address, ethers.parseEther("2000"));
      await exaToken.connect(addr1).transfer(addr2Address, ethers.parseEther("500"));
      
      // 모든 주소의 잔고 조회
      const ownerBalance = await exaToken.balanceOf(ownerAddress);
      const addr1Balance = await exaToken.balanceOf(addr1Address);
      const addr2Balance = await exaToken.balanceOf(addr2Address);
      
      // 잔고 합계 계산
      const totalBalance = ownerBalance + addr1Balance + addr2Balance;
      
      // 총 공급량 조회
      const totalSupply = await exaToken.totalSupply();
      
      // 검증
      expect(totalBalance).to.equal(totalSupply);
    });
  });

  describe("Lockup and Balance Correlation Tests", function () {
    it("Balance should correctly show the total amount including locked tokens", async function () {
      // 테스트 계정에 토큰 전송
      const transferAmount = ethers.parseEther("1000");
      await exaToken.transfer(addr1Address, transferAmount);
      
      // 초기 잔고 확인
      const initialBalance = await exaToken.balanceOf(addr1Address);
      expect(initialBalance).to.equal(transferAmount);
      
      // 락업 설정
      const lockAmount = ethers.parseEther("500");
      const releaseTime = Math.floor(Date.now() / 1000) + 3600; // 1시간 후
      const termOfRound = 86400; // 1일
      const releaseRate = 10; // 10%
      
      await exaToken.lock(addr1Address, lockAmount, releaseTime, termOfRound, releaseRate);
      
      // 락업 후 잔고 확인 - 잔고는 변함없이 1000이어야 함 (락업은 잔고에 포함됨)
      const afterLockBalance = await exaToken.balanceOf(addr1Address);
      
      // 검증
      expect(afterLockBalance).to.equal(transferAmount);
    });

    it("Balance should be correctly displayed after unlocking tokens", async function () {
      // 테스트 계정에 토큰 전송
      const transferAmount = ethers.parseEther("1000");
      await exaToken.transfer(addr1Address, transferAmount);
      
      // 락업 설정
      const lockAmount = ethers.parseEther("500");
      const releaseTime = Math.floor(Date.now() / 1000) + 1; // 1초 후 (바로 테스트 가능하도록)
      const termOfRound = 1; // 1초
      const releaseRate = 100; // 100% (한 번에 모두 해제)
      
      await exaToken.lock(addr1Address, lockAmount, releaseTime, termOfRound, releaseRate);
      
      // 잠금 설정 직후 잔고 확인
      const balanceAfterLock = await exaToken.balanceOf(addr1Address);
      expect(balanceAfterLock).to.equal(transferAmount);
      
      // 약간의 시간 지연
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 수동으로 unlock 함수 호출
      await exaToken.unlock(addr1Address, 0);
      
      // 잠금 해제 후 잔고 확인
      const balanceAfterUnlock = await exaToken.balanceOf(addr1Address);
      
      // 검증 - 잔고는 여전히 1000이어야 함
      expect(balanceAfterUnlock).to.equal(transferAmount);
    });
  });
}); 