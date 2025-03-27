import { expect } from "chai";
import { ethers } from "hardhat";

describe("EXAToken Pause/Unpause Functionality Tests", function () {
  let exaToken: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let ownerAddress: string;
  let addr1Address: string;
  let addr2Address: string;

  beforeEach(async function () {
    // 계정 설정
    [owner, addr1, addr2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    addr1Address = await addr1.getAddress();
    addr2Address = await addr2.getAddress();

    // EXAToken 배포
    const EXAToken = await ethers.getContractFactory("EXAToken");
    exaToken = await EXAToken.deploy();
    
    // 테스트용 토큰 전송
    const transferAmount = ethers.parseEther("1000");
    await exaToken.transfer(addr1Address, transferAmount);
  });

  describe("Basic Pause/Unpause Permission Tests", function () {
    it("Only owner should be able to call the pause() function", async function () {
      // 비소유자가 호출하면 실패해야 함
      await expect(
        exaToken.connect(addr1).pause()
      ).to.be.reverted;

      // 오너가 호출하면 성공해야 함
      await expect(
        exaToken.pause()
      ).to.not.be.reverted;
    });

    it("Only owner should be able to call the unpause() function", async function () {
      // 먼저 일시 중지
      await exaToken.pause();

      // 비소유자가 호출하면 실패해야 함
      await expect(
        exaToken.connect(addr1).unpause()
      ).to.be.reverted;

      // 오너가 호출하면 성공해야 함
      await expect(
        exaToken.unpause()
      ).to.not.be.reverted;
    });
  });

  describe("Pause Functionality Tests", function () {
    it("Contract state should be paused after calling pause()", async function () {
      // pause 호출
      await exaToken.pause();
      
      // 컨트랙트 상태 확인
      const isPaused = await exaToken.paused();
      expect(isPaused).to.be.true;
    });

    it("transfer function should fail after calling pause()", async function () {
      // pause 호출
      await exaToken.pause();
      
      // transfer 시도
      await expect(
        exaToken.connect(addr1).transfer(addr2Address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("transferFrom function should fail after calling pause()", async function () {
      // approve 설정
      await exaToken.connect(addr1).approve(addr2Address, ethers.parseEther("100"));
      
      // pause 호출
      await exaToken.pause();
      
      // transferFrom 시도
      await expect(
        exaToken.connect(addr2).transferFrom(addr1Address, addr2Address, ethers.parseEther("50"))
      ).to.be.reverted;
    });

    it("approve function should fail after calling pause()", async function () {
      // pause 호출
      await exaToken.pause();
      
      // approve 시도
      await expect(
        exaToken.connect(addr1).approve(addr2Address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });

  describe("Unpause Functionality Tests", function () {
    beforeEach(async function () {
      // 모든 테스트 전에 pause 실행
      await exaToken.pause();
    });

    it("Contract state should return to normal after calling unpause()", async function () {
      // unpause 호출
      await exaToken.unpause();
      
      // 컨트랙트 상태 확인
      const isPaused = await exaToken.paused();
      expect(isPaused).to.be.false;
    });

    it("transfer function should work again after calling unpause()", async function () {
      // unpause 호출
      await exaToken.unpause();
      
      // transfer 시도
      await expect(
        exaToken.connect(addr1).transfer(addr2Address, ethers.parseEther("100"))
      ).to.not.be.reverted;
      
      // 잔액 확인
      const addr2Balance = await exaToken.balanceOf(addr2Address);
      expect(addr2Balance).to.equal(ethers.parseEther("100"));
    });

    it("transferFrom function should work again after calling unpause()", async function () {
      // 먼저 unpause해서 approve 가능하게 함
      await exaToken.unpause();
      
      // approve 설정
      await exaToken.connect(addr1).approve(addr2Address, ethers.parseEther("100"));
      
      // transferFrom 시도
      await expect(
        exaToken.connect(addr2).transferFrom(addr1Address, addr2Address, ethers.parseEther("50"))
      ).to.not.be.reverted;
      
      // 잔액 확인
      const addr2Balance = await exaToken.balanceOf(addr2Address);
      expect(addr2Balance).to.equal(ethers.parseEther("50"));
    });

    it("approve function should work again after calling unpause()", async function () {
      // unpause 호출
      await exaToken.unpause();
      
      // approve 시도
      await expect(
        exaToken.connect(addr1).approve(addr2Address, ethers.parseEther("100"))
      ).to.not.be.reverted;
      
      // allowance 확인
      const allowance = await exaToken.allowance(addr1Address, addr2Address);
      expect(allowance).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Pause/Unpause Complex Scenario Tests", function () {
    it("Functions should work properly after multiple pause/unpause cycles", async function () {
      // 1차 pause
      await exaToken.pause();
      let isPaused = await exaToken.paused();
      expect(isPaused).to.be.true;
      
      // transfer 실패 확인
      await expect(
        exaToken.connect(addr1).transfer(addr2Address, ethers.parseEther("10"))
      ).to.be.reverted;
      
      // 1차 unpause
      await exaToken.unpause();
      isPaused = await exaToken.paused();
      expect(isPaused).to.be.false;
      
      // transfer 성공 확인
      await expect(
        exaToken.connect(addr1).transfer(addr2Address, ethers.parseEther("10"))
      ).to.not.be.reverted;
      
      // 2차 pause
      await exaToken.pause();
      isPaused = await exaToken.paused();
      expect(isPaused).to.be.true;
      
      // 다시 transfer 실패 확인
      await expect(
        exaToken.connect(addr1).transfer(addr2Address, ethers.parseEther("10"))
      ).to.be.reverted;
      
      // 2차 unpause
      await exaToken.unpause();
      isPaused = await exaToken.paused();
      expect(isPaused).to.be.false;
      
      // 다시 transfer 성공 확인
      await expect(
        exaToken.connect(addr1).transfer(addr2Address, ethers.parseEther("10"))
      ).to.not.be.reverted;
    });

    it("Other critical administrative functions should continue to work while paused", async function () {
      // pause 호출
      await exaToken.pause();
      
      // 컨트랙트 상태 확인
      const isPaused = await exaToken.paused();
      expect(isPaused).to.be.true;
      
      
      // 오너십 이전 기능 테스트 (관리 기능은 계속 작동해야 함)
      await expect(
        exaToken.transferOwnership(addr2Address)
      ).to.not.be.reverted;
      
      // 소유자가 변경되었는지 확인
      const newOwner = await exaToken.owner();
      expect(newOwner).to.equal(addr2Address);
    });
  });
}); 