# EstateX Protocol EXA Token

EXAToken is an ERC20-compatible token based on the OpenZeppelin library. This project includes token lockup, account freezing, and token burning functionalities.

## Key Features

- **ERC20 Basic Functions**: Implementation of ERC20 standard features including transfer, balance inquiry, and approval
- **Lockup Feature**: Ability to lock tokens for a specific period (with customizable release time)
- **Account Freezing**: Feature to restrict token transfers from specific accounts
- **Token Burning**: Burning functionality to reduce token supply
- **Token Recovery**: Feature to recover other tokens mistakenly sent to the contract

## Technology Stack

- Solidity: Smart contract development language
- Hardhat: Ethereum development environment
- OpenZeppelin: Secure smart contract library
- TypeScript: Testing and deployment scripts

## Getting Started

### Requirements

- Node.js v14 or higher
- npm or yarn

### Installation

```shell
npm install
```

### Running Tests

```shell
npx hardhat test
```

### Running Specific Tests

```shell
npx hardhat test test/FreezeQueryTest.ts
```


## License

MIT
