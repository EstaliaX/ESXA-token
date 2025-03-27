// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";


interface TokenRecipient {
    function receiveApproval(address _from, uint256 _value, address _token, bytes calldata _extraData) external;
}

contract EXAToken is IERC20, Ownable, Pausable {
    struct LockupInfo {
        uint256 releaseTime;
        uint256 termOfRound;
        uint256 unlockAmountPerRound;
        uint256 lockupBalance;
    }

    string public name;
    string public symbol;
    uint8 constant public decimals =18;
    uint256 internal initialSupply;
    uint256 internal totalSupply_;

    mapping(address => uint256) internal balances;
    mapping(address => bool) internal locks;
    mapping(address => bool) public frozen;
    mapping(address => mapping(address => uint256)) internal allowed;
    mapping(address => LockupInfo[]) internal lockupInfo;

    event Lock(address indexed holder, uint256 value);
    event Unlock(address indexed holder, uint256 value);
    event Burn(address indexed owner, uint256 value);
    
    modifier notFrozen(address _holder) {
        require(!frozen[_holder], "Account is frozen");
        _;
    }

    constructor() Ownable(msg.sender) {
        name = "EstateX Protocol";
        symbol = "EXA";
        initialSupply = 1*(10**9);
        totalSupply_ = initialSupply * 10 ** uint(decimals);
        balances[msg.sender] = totalSupply_;
        emit Transfer(address(0), msg.sender, totalSupply_);
    }

    // Fallback
    receive() external payable {
        revert("Direct ETH transfer not allowed");
    }
    
    fallback() external payable {
        revert("Direct ETH transfer not allowed");
    }

    function totalSupply() public view override returns (uint256) {
        return totalSupply_;
    }

    function transfer(address _to, uint256 _value) public override whenNotPaused notFrozen(msg.sender) returns (bool) {
        if (locks[msg.sender]) {
            autoUnlock(msg.sender);
        }
        require(_to != address(0), "Cannot transfer to zero address");
        require(_value <= balances[msg.sender], "Insufficient balance");

        // SafeMath.sub will throw if there is not enough balance.
        balances[msg.sender] = balances[msg.sender] - _value;
        balances[_to] = balances[_to] + _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function balanceOf(address _holder) public view override returns (uint256 balance) {
        uint256 lockedBalance = 0;
        if(locks[_holder]) {
            for(uint256 idx = 0; idx < lockupInfo[_holder].length ; idx++ ) {
                lockedBalance = lockedBalance + lockupInfo[_holder][idx].lockupBalance;
            }
        }
        return balances[_holder] + lockedBalance;
    }

    function transferFrom(address _from, address _to, uint256 _value) public override whenNotPaused notFrozen(_from) returns (bool) {
        if (locks[_from]) {
            autoUnlock(_from);
        }
        require(_to != address(0), "Cannot transfer to zero address");
        require(_value <= balances[_from], "Insufficient balance");
        require(_value <= allowed[_from][msg.sender], "Insufficient allowance");

        balances[_from] = balances[_from] - _value;
        balances[_to] = balances[_to] + _value;
        allowed[_from][msg.sender] = allowed[_from][msg.sender] - _value;
        emit Transfer(_from, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) public override whenNotPaused returns (bool) {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function approveAndCall(address _spender, uint256 _value, bytes memory _extraData) public returns (bool success) {
        require(isContract(_spender), "Spender must be a contract");
        TokenRecipient spender = TokenRecipient(_spender);
        if (approve(_spender, _value)) {
            spender.receiveApproval(msg.sender, _value, address(this), _extraData);
            return true;
        }
        return false;
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        require(spender != address(0), "Cannot approve zero address");
        allowed[msg.sender][spender] = (allowed[msg.sender][spender] + addedValue);

        emit Approval(msg.sender, spender, allowed[msg.sender][spender]);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        require(spender != address(0), "Cannot approve zero address");
        allowed[msg.sender][spender] = (allowed[msg.sender][spender] - subtractedValue);

        emit Approval(msg.sender, spender, allowed[msg.sender][spender]);
        return true;
    }

    function allowance(address _holder, address _spender) public view override returns (uint256) {
        return allowed[_holder][_spender];
    }

    function lock(address _holder, uint256 _amount, uint256 _releaseStart, uint256 _termOfRound, uint256 _releaseRate) public onlyOwner returns (bool) {
        require(balances[_holder] >= _amount, "Insufficient balance for lock");
        if(_termOfRound==0 ) {
            _termOfRound = 1;
        }
        balances[_holder] = balances[_holder] - _amount;
        lockupInfo[_holder].push(
            LockupInfo(_releaseStart, _termOfRound, _amount * _releaseRate / 100, _amount)
        );

        locks[_holder] = true;

        emit Lock(_holder, _amount);

        return true;
    }

    function unlock(address _holder, uint256 _idx) public onlyOwner returns (bool) {
        require(locks[_holder], "Account not locked");
        require(_idx < lockupInfo[_holder].length, "Invalid lockup index");
        LockupInfo storage lockupinfo = lockupInfo[_holder][_idx];
        uint256 releaseAmount = lockupinfo.lockupBalance;

        delete lockupInfo[_holder][_idx];
        lockupInfo[_holder][_idx] = lockupInfo[_holder][lockupInfo[_holder].length - 1];
        lockupInfo[_holder].pop();
        if(lockupInfo[_holder].length == 0) {
            locks[_holder] = false;
        }

        emit Unlock(_holder, releaseAmount);
        balances[_holder] = balances[_holder] + releaseAmount;

        return true;
    }


    function getNowTime() public view returns(uint256) {
        return block.timestamp;
    }

    function showLockState(address _holder, uint256 _idx) public view returns (bool, uint256, uint256, uint256, uint256, uint256) {
        if(locks[_holder]) {
            return (
                locks[_holder],
                lockupInfo[_holder].length,
                lockupInfo[_holder][_idx].lockupBalance,
                lockupInfo[_holder][_idx].releaseTime,
                lockupInfo[_holder][_idx].termOfRound,
                lockupInfo[_holder][_idx].unlockAmountPerRound
            );
        } else {
            return (
                locks[_holder],
                lockupInfo[_holder].length,
                0,0,0,0
            );
        }
    }

    function distribute(address _to, uint256 _value) public onlyOwner returns (bool) {
        require(_to != address(0), "Cannot distribute to zero address");
        require(_value <= balances[owner()], "Insufficient balance");

        balances[owner()] = balances[owner()] - _value;
        balances[_to] = balances[_to] + _value;
        emit Transfer(owner(), _to, _value);
        return true;
    }

    function distributeWithLockup(address _to, uint256 _value, uint256 _releaseStart, uint256 _termOfRound, uint256 _releaseRate) public onlyOwner returns (bool) {
        distribute(_to, _value);
        lock(_to, _value, _releaseStart, _termOfRound, _releaseRate);
        return true;
    }

    function claimToken(IERC20 token, address _to, uint256 _value) public onlyOwner returns (bool) {
        token.transfer(_to, _value);
        return true;
    }

    function burn(uint256 _value) public onlyOwner returns (bool success) {
        require(_value <= balances[msg.sender], "Insufficient balance");
        address burner = msg.sender;
        balances[burner] = balances[burner] - _value;
        totalSupply_ = totalSupply_ - _value;
        emit Burn(burner, _value);
        emit Transfer(burner, address(0), _value);
        return true;
    }

    function isContract(address addr) internal view returns (bool) {
        uint size;
        assembly {size := extcodesize(addr)}
        return size > 0;
    }

    function autoUnlock(address _holder) internal returns (bool) {
        for(uint256 idx = 0; idx < lockupInfo[_holder].length;) {
            if(locks[_holder] == false) {
                return true;
            }
            if (lockupInfo[_holder][idx].releaseTime <= block.timestamp) {
                
                if(releaseTimeLock(_holder, idx)) {
                } else {
                    idx++;
                }
            } else {
                idx++;
            }
        }
        return true;
    }

    function releaseTimeLock(address _holder, uint256 _idx) internal returns(bool) {
        require(locks[_holder], "Account not locked");
        require(_idx < lockupInfo[_holder].length, "Invalid lockup index");

        LockupInfo storage info = lockupInfo[_holder][_idx];
        uint256 releaseAmount = info.unlockAmountPerRound;
        
        uint256 sinceFrom;
        if (block.timestamp > info.releaseTime) {
            sinceFrom = block.timestamp - info.releaseTime;
        } else {
            sinceFrom = 0;
        }
        
        uint256 sinceRound;
        if (info.termOfRound > 0) {
            sinceRound = sinceFrom / info.termOfRound;
        } else {
            sinceRound = 0;
        }
        
        releaseAmount = releaseAmount + (sinceRound * info.unlockAmountPerRound);

        if(releaseAmount >= info.lockupBalance) {
            releaseAmount = info.lockupBalance;

            if(_idx < lockupInfo[_holder].length - 1) {
                lockupInfo[_holder][_idx] = lockupInfo[_holder][lockupInfo[_holder].length - 1];
            }
            lockupInfo[_holder].pop();

            if(lockupInfo[_holder].length == 0) {
                locks[_holder] = false;
            }
            emit Unlock(_holder, releaseAmount);
            balances[_holder] = balances[_holder] + releaseAmount;
            return true;
        } else {
            if (info.termOfRound > 0 && sinceRound > 0) {
                info.releaseTime = info.releaseTime + ((sinceRound + 1) * info.termOfRound);
            }
            
            info.lockupBalance = info.lockupBalance - releaseAmount;
            emit Unlock(_holder, releaseAmount);
            balances[_holder] = balances[_holder] + releaseAmount;
            return false;
        }
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
