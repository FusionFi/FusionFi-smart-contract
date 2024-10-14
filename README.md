# FussionFi-smart-contract
FusionFi smart contracts

## Price aggregator
We use ChainLink contract

## DefaultReserveInterestRateStrategy
This contract contains the base arguments which are used to calculate the borrowing interest rate and lending interest rate

We use this form Aave

The contract name: DefaultReserveInterestRateStrategy.sol

## FSFIPool
This contract will manage the pool fund. Each contract only accepts one currency. If we have USDT, USDC, we need to deploy 2 smart contracts.

The contract name: FSFIPool.sol

We deploy proxy for this contract

## FSFILoan
This contract contains the independence loan information and interacts with the Aave and Uniswap contracts.

We will clone this contract for each loan. So, each loan is safe and works independently.

The contract name: FSFILoan.sol

## FSFIConfig
This contract contains all configs of CCFL contract.

The contract name: FSFIConfig.sol

We deploy proxy for this contract

## FSFI
This contract handles all loan information and active pools. Most of the actions will happen on this contract.

The contract name: FSFI.sol

We deploy a proxy for this contract

## Basic commands
npx hardhat compile

npx hardhat test

npx hardhat coverage

npx hardhat ignition deploy ignition/modules/FSFI.ts --network sepolia --reset

npx hardhat verify 0x85B85Aa3dAcdE3bcc1EDbFf6701aA0541162Abef --network sepolia

remixd -s ./contracts -u https://remix.ethereum.org/

npx ts-node 
