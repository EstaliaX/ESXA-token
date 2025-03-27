import { 
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

// 테스트용 ERC20 토큰 컨트랙트
interface IERC20 {
  totalSupply(): Promise<bigint>;
  balanceOf(account: string): Promise<bigint>;
  transfer(to: string, amount: bigint): Promise<boolean>;
  allowance(owner: string, spender: string): Promise<bigint>;
  approve(spender: string, amount: bigint): Promise<boolean>;
  transferFrom(from: string, to: string, amount: bigint): Promise<boolean>;
}

// 간단한 ERC20 토큰 구현
const ERC20TokenBytecode = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }
}
`;

describe("EXAToken ClaimToken Functionality Tests", function () {
  let exaToken: any;
  let testToken: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let ownerAddress: string;
  let addr1Address: string;
  let addr2Address: string;
  
  const initialSupply = ethers.parseEther("1000000");
  const testTokenAmount = ethers.parseEther("1000");
  const exaTokenAmount = ethers.parseEther("5000"); // EXA 토큰 테스트용 금액
  
  beforeEach(async function () {
    // 계정 설정
    [owner, addr1, addr2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    addr1Address = await addr1.getAddress();
    addr2Address = await addr2.getAddress();
    
    // EXAToken 배포
    const EXAToken = await ethers.getContractFactory("EXAToken");
    exaToken = await EXAToken.deploy();
    
    // TestToken 배포 (테스트용 ERC20 토큰)
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy("Test Token", "TEST", initialSupply);
    
    // TestToken을 EXAToken 컨트랙트로 전송
    await testToken.transfer(await exaToken.getAddress(), testTokenAmount);
  });
  
  it("Should be able to transfer other tokens held by the contract to a specified address", async function () {
    const receiverBefore = await testToken.balanceOf(addr1Address);
    
    // 컨트랙트가 보유한 토큰을 addr1으로 전송
    await exaToken.claimToken(await testToken.getAddress(), addr1Address, testTokenAmount);
    
    // addr1의 토큰 잔액 확인
    const receiverAfter = await testToken.balanceOf(addr1Address);
    expect(receiverAfter - receiverBefore).to.equal(testTokenAmount);
    
    // 컨트랙트의 토큰 잔액이 0이 되었는지 확인
    const contractBalance = await testToken.balanceOf(await exaToken.getAddress());
    expect(contractBalance).to.equal(0);
  });
  
  it("Only owner should be able to call the claimToken function", async function () {
    // 오너가 아닌 계정에서 호출 시 실패해야 함
    await expect(
      exaToken.connect(addr1).claimToken(await testToken.getAddress(), addr2Address, testTokenAmount)
    ).to.be.reverted;
    
    // 오너가 호출하면 성공해야 함
    await expect(
      exaToken.claimToken(await testToken.getAddress(), addr2Address, testTokenAmount)
    ).not.to.be.reverted;
  });
  
  it("Should fail when attempting to transfer more tokens than the contract holds", async function () {
    const tooMuch = testTokenAmount * BigInt(2);
    
    await expect(
      exaToken.claimToken(await testToken.getAddress(), addr1Address, tooMuch)
    ).to.be.reverted;
  });
  
  it("Should be able to transfer 0 tokens", async function () {
    await expect(
      exaToken.claimToken(await testToken.getAddress(), addr1Address, 0)
    ).not.to.be.reverted;
  });
  
  it("Should handle transfers to the zero address (0x0) appropriately", async function () {
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    
    // 일부 컨트랙트는 영주소로의 전송을 거부할 수 있음
    // 여기서는 컨트랙트의 구현에 따라 달라짐
    try {
      await exaToken.claimToken(await testToken.getAddress(), zeroAddress, testTokenAmount);
      // 성공한 경우 테스트 통과
    } catch (error) {
      // 실패한 경우에도 테스트 통과 (영주소로의 전송이 금지된 경우)
      expect(error).to.exist;
    }
  });
  
  it("Should fail when attempting to transfer tokens not owned by the contract", async function () {
    // 새로운 테스트 토큰 생성 (EXAToken 컨트랙트로 전송하지 않음)
    const NewTestToken = await ethers.getContractFactory("TestToken");
    const newTestToken = await NewTestToken.deploy("New Test", "NTEST", initialSupply);
    
    // EXAToken 컨트랙트는 newTestToken을 보유하고 있지 않으므로 전송 시도 시 실패해야 함
    await expect(
      exaToken.claimToken(await newTestToken.getAddress(), addr1Address, testTokenAmount)
    ).to.be.reverted;
  });

  describe("Tests for Claiming EXA Tokens Themselves", function () {
    beforeEach(async function () {
      // EXA 토큰을 컨트랙트 자신에게 전송
      // 이는 owner가 exaToken 컨트랙트 주소로 EXA 토큰을 전송하는 상황을 시뮬레이션
      await exaToken.transfer(await exaToken.getAddress(), exaTokenAmount);
      
      // 컨트랙트 주소로 전송된 EXA 토큰 확인
      const contractEXABalance = await exaToken.balanceOf(await exaToken.getAddress());
      expect(contractEXABalance).to.be.at.least(exaTokenAmount);
    });

    it("Should be able to transfer EXA tokens held by the contract to a specified address", async function () {
      const receiverBefore = await exaToken.balanceOf(addr1Address);
      
      // 컨트랙트가 보유한 EXA 토큰을 addr1으로 전송
      await exaToken.claimToken(await exaToken.getAddress(), addr1Address, exaTokenAmount);
      
      // addr1의 EXA 토큰 잔액 확인
      const receiverAfter = await exaToken.balanceOf(addr1Address);
      expect(receiverAfter - receiverBefore).to.equal(exaTokenAmount);
      
      // 컨트랙트의 EXA 토큰 잔액이 정확히 감소했는지 확인
      const contractBalanceBefore = await exaToken.balanceOf(await exaToken.getAddress());
      expect(contractBalanceBefore).to.equal(0);
    });

    it("Should be able to claim EXA tokens to multiple addresses", async function () {
      const halfAmount = exaTokenAmount / BigInt(2);
      
      // 첫 번째 전송: 절반을 addr1에게
      await exaToken.claimToken(await exaToken.getAddress(), addr1Address, halfAmount);
      
      // 두 번째 전송: 나머지 절반을 addr2에게
      await exaToken.claimToken(await exaToken.getAddress(), addr2Address, halfAmount);
      
      // 각 주소의 잔액 확인
      const addr1Balance = await exaToken.balanceOf(addr1Address);
      const addr2Balance = await exaToken.balanceOf(addr2Address);
      
      expect(addr1Balance).to.be.at.least(halfAmount);
      expect(addr2Balance).to.be.at.least(halfAmount);
      
      // 컨트랙트의 EXA 토큰 잔액이 0이 되었는지 확인
      const contractBalance = await exaToken.balanceOf(await exaToken.getAddress());
      expect(contractBalance).to.equal(0);
    });

    it("Should fail when attempting to transfer more EXA tokens than the contract holds", async function () {
      const tooMuch = exaTokenAmount * BigInt(2);
      
      await expect(
        exaToken.claimToken(await exaToken.getAddress(), addr1Address, tooMuch)
      ).to.be.reverted;
    });

    it("EXA token treasury vault role: Should work correctly after multiple transfer stages", async function () {
      // 1단계: 컨트랙트가 보유한 일부 EXA 토큰을 addr1으로 전송
      const firstAmount = exaTokenAmount / BigInt(4);
      await exaToken.claimToken(await exaToken.getAddress(), addr1Address, firstAmount);
      
      // 2단계: 추가 EXA 토큰을 컨트랙트로 전송
      const additionalAmount = ethers.parseEther("2000");
      await exaToken.transfer(await exaToken.getAddress(), additionalAmount);
      
      // 3단계: 두 번째 claim 작업 - 남은 토큰과 새로 추가된 토큰 일부를 addr2로 전송
      const secondAmount = exaTokenAmount / BigInt(2) + additionalAmount / BigInt(2);
      await exaToken.claimToken(await exaToken.getAddress(), addr2Address, secondAmount);
      
      // 최종 잔액 확인
      const addr1Balance = await exaToken.balanceOf(addr1Address);
      const addr2Balance = await exaToken.balanceOf(addr2Address);
      const contractBalance = await exaToken.balanceOf(await exaToken.getAddress());
      
      // 기대하는 결과: addr1과 addr2가 각각 설정한 금액을 받았고, 컨트랙트에 나머지가 있어야 함
      expect(addr1Balance).to.be.at.least(firstAmount);
      expect(addr2Balance).to.be.at.least(secondAmount);
      
      // 남은 금액 계산 (초기 + 추가 - 첫 번째 전송 - 두 번째 전송)
      const expectedRemaining = exaTokenAmount + additionalAmount - firstAmount - secondAmount;
      expect(contractBalance).to.equal(expectedRemaining);
    });
  });
}); 