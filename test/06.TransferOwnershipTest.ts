import { expect } from "chai";
import { ethers } from "hardhat";

describe("EXAToken Ownership Transfer Tests", function () {
  let exaToken: any;
  let owner: any;
  let newOwner: any;
  let addr1: any;
  let ownerAddress: string;
  let newOwnerAddress: string;
  let addr1Address: string;

  beforeEach(async function () {
    // 계정 설정
    [owner, newOwner, addr1] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    newOwnerAddress = await newOwner.getAddress();
    addr1Address = await addr1.getAddress();

    // EXAToken 배포
    const EXAToken = await ethers.getContractFactory("EXAToken");
    exaToken = await EXAToken.deploy();
  });

  describe("Basic Ownership Tests", function () {
    it("Contract deployer should be set as initial owner", async function () {
      // 현재 소유자 확인
      const currentOwner = await exaToken.owner();
      expect(currentOwner).to.equal(ownerAddress);
    });

    it("Only owner should be able to call transferOwnership", async function () {
      // 비소유자가 호출하면 실패해야 함
      await expect(
        exaToken.connect(addr1).transferOwnership(newOwnerAddress)
      ).to.be.reverted;

      // 오너가 호출하면 성공해야 함
      await expect(
        exaToken.transferOwnership(newOwnerAddress)
      ).to.not.be.reverted;
    });
  });

  describe("Ownership Transfer Functionality Tests", function () {
    it("New address should be set as owner after transferOwnership", async function () {
      // 오너십 이전
      await exaToken.transferOwnership(newOwnerAddress);
      
      // 변경된 소유자 확인
      const currentOwner = await exaToken.owner();
      expect(currentOwner).to.equal(newOwnerAddress);
    });

    

    it("Should not be able to transfer ownership to the zero address (0x0)", async function () {
      const zeroAddress = ethers.ZeroAddress;
      
      // 제로 주소로 오너십 이전 시도 시 실패해야 함
      await expect(
        exaToken.transferOwnership(zeroAddress)
      ).to.be.reverted;
    });
  });

  describe("Ownership and Permission Restriction Tests", function () {
    it("Only owner should be able to use the token burn function", async function () {
      const burnAmount = BigInt(1000);
      
      // 비소유자가 소각 시도 시 실패해야 함
      await expect(
        exaToken.connect(addr1).burn(burnAmount)
      ).to.be.reverted;
      
      // 소유자가 소각 시도 시 성공해야 함
      await expect(
        exaToken.burn(burnAmount)
      ).to.not.be.reverted;
    });

    
    it("Only owner should be able to use the token lockup function", async function () {
      // 테스트를 위해 addr1에 토큰 전송
      const transferAmount = BigInt("1000000000000000000"); // 1 토큰
      await exaToken.transfer(addr1Address, transferAmount);
      
      // 락업 설정
      const lockAmount = transferAmount / BigInt(2); // 0.5 토큰
      const releaseStart = Math.floor(Date.now() / 1000) + 3600; // 1시간 후
      const termOfRound = 86400; // 1일
      const releaseRate = 10; // 10%
      
      // 비소유자가 락업 시도 시 실패해야 함
      await expect(
        exaToken.connect(addr1).lock(addr1Address, lockAmount, releaseStart, termOfRound, releaseRate)
      ).to.be.reverted;
      
      // 소유자가 락업 시도 시 성공해야 함
      await expect(
        exaToken.lock(addr1Address, lockAmount, releaseStart, termOfRound, releaseRate)
      ).to.not.be.reverted;
    });
  });

  describe("Ownership Transfer Scenario Tests", function () {
    it("Final owner should be correctly set after multiple ownership transfers", async function () {
      // 첫 번째 오너십 이전
      await exaToken.transferOwnership(newOwnerAddress);
      
      // 두 번째 소유자에서 세 번째 소유자로 이전
      await exaToken.connect(newOwner).transferOwnership(addr1Address);
      
      // 세 번째 소유자에서 다시 첫 번째 소유자로 이전
      await exaToken.connect(addr1).transferOwnership(ownerAddress);
      
      // 최종 소유자 확인
      const finalOwner = await exaToken.owner();
      expect(finalOwner).to.equal(ownerAddress);
    });

    it("Only the new owner should be able to use important management functions after ownership transfer", async function () {
      // 오너십 이전
      await exaToken.transferOwnership(newOwnerAddress);
      
      // 중요 관리 기능 테스트 (pause/unpause)
      
      // 이전 소유자가 pause 호출 시 실패해야 함
      await expect(
        exaToken.connect(owner).pause()
      ).to.be.reverted;
      
      // 새 소유자가 pause 호출 시 성공해야 함
      await expect(
        exaToken.connect(newOwner).pause()
      ).to.not.be.reverted;
      
      // 일반 사용자 전송 테스트 (일시 중지 상태에서는 실패해야 함)
      await expect(
        exaToken.connect(owner).transfer(addr1Address, 1000)
      ).to.be.reverted;
      
      // 새 소유자가 unpause 호출 시 성공해야 함
      await expect(
        exaToken.connect(newOwner).unpause()
      ).to.not.be.reverted;
      
      // unpause 후 전송 다시 가능해야 함
      await expect(
        exaToken.connect(owner).transfer(addr1Address, 1000)
      ).to.not.be.reverted;
    });
  });
}); 