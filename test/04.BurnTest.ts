import { expect } from "chai";
import { ethers } from "hardhat";

describe("EXAToken Burn Functionality Tests", function () {
  let exaToken: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let ownerAddress: string;
  let addr1Address: string;

  beforeEach(async function () {
    // 계정 설정
    [owner, addr1, addr2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    addr1Address = await addr1.getAddress();

    // EXAToken 배포
    const EXAToken = await ethers.getContractFactory("EXAToken");
    exaToken = await EXAToken.deploy();
  });

  it("burn() - Owner should be able to burn their own tokens", async function () {
    // 초기 총 공급량 및 소유자 잔액 확인
    const initialTotalSupply = await exaToken.totalSupply();
    const initialOwnerBalance = await exaToken.balanceOf(ownerAddress);

    // 소각할 금액 설정 (초기 잔액의 10%)
    const burnAmount = initialOwnerBalance / BigInt(10);

    // 소각 실행
    await expect(exaToken.burn(burnAmount))
      .to.emit(exaToken, "Burn")
      .withArgs(ownerAddress, burnAmount)
      .and.to.emit(exaToken, "Transfer")
      .withArgs(ownerAddress, ethers.ZeroAddress, burnAmount);

    // 소각 후 총 공급량 및 소유자 잔액 확인
    const finalTotalSupply = await exaToken.totalSupply();
    const finalOwnerBalance = await exaToken.balanceOf(ownerAddress);

    // 검증
    expect(finalTotalSupply).to.equal(initialTotalSupply - burnAmount);
    expect(finalOwnerBalance).to.equal(initialOwnerBalance - burnAmount);
  });

  it("burn() - Owner should not be able to burn more tokens than their balance", async function () {
    // 소유자의 초기 잔액 확인
    const ownerBalance = await exaToken.balanceOf(ownerAddress);
    
    // 잔액보다 많은 금액 시도
    const exceedAmount = ownerBalance + BigInt(1);
    
    // 소각 시도 시 실패해야 함
    await expect(exaToken.burn(exceedAmount))
      .to.be.revertedWith("Insufficient balance");
  });

  it("burn() - Non-owner accounts should not be able to burn tokens", async function () {
    // 소유자의 초기 잔액 확인
    const ownerBalance = await exaToken.balanceOf(ownerAddress);
    
    // 일부 토큰을 addr1에게 전송
    const transferAmount = ownerBalance / BigInt(10);
    await exaToken.transfer(addr1Address, transferAmount);
    
    // addr1이 토큰 소각 시도 - 실패해야 함
    await expect(exaToken.connect(addr1).burn(transferAmount))
      .to.be.reverted;
  });

  it("burn() - Total supply should decrease exactly by the burned amount", async function () {
    // 초기 총 공급량 확인
    const initialTotalSupply = await exaToken.totalSupply();
    
    // 다양한 금액으로 여러 번 소각 실행
    const burnAmounts = [
      initialTotalSupply / BigInt(100),
      initialTotalSupply / BigInt(200),
      initialTotalSupply / BigInt(500)
    ];
    
    let expectedTotalSupply = initialTotalSupply;
    
    for (const amount of burnAmounts) {
      await exaToken.burn(amount);
      expectedTotalSupply = expectedTotalSupply - amount;
      
      // 소각 후 총 공급량 확인
      const currentTotalSupply = await exaToken.totalSupply();
      expect(currentTotalSupply).to.equal(expectedTotalSupply);
    }
  });
}); 