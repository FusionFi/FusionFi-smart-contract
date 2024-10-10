import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { assert, parseUnits } from "ethers";

describe("fsfiPool contract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [
      owner,
      borrower1,
      borrower2,
      borrower3,
      lender1,
      lender2,
      lender3,
      liquidator,
      platform,
    ] = await hre.ethers.getSigners();

    const USDC = await hre.ethers.getContractFactory("MyERC20");
    const usdc = await USDC.deploy("USDC", "USDC");

    const LINK = await hre.ethers.getContractFactory("MyERC20");
    const link = await LINK.deploy("LINK", "LINK");

    const ATOKEN = await hre.ethers.getContractFactory("MyERC20");
    const aToken = await ATOKEN.deploy("ATOKEN", "ATOKEN");

    const DefaultReserveInterestRateStrategy =
      await hre.ethers.getContractFactory("DefaultReserveInterestRateStrategy");
    const defaultReserveInterestRateStrategy =
      await DefaultReserveInterestRateStrategy.deploy(
        parseUnits("0.80", 27).toString(),
        parseUnits("0.05", 27).toString(),
        parseUnits("0.04", 27).toString(),
        parseUnits("3", 27).toString()
      );

    const FSFIPool = await hre.ethers.getContractFactory("FSFIPool");
    const fsfiPool = await hre.upgrades.deployProxy(
      FSFIPool,
      [
        await usdc.getAddress(),
        await defaultReserveInterestRateStrategy.getAddress(),
      ],
      { initializer: "initialize" }
    );

    console.log(
      "pool implement",
      await hre.upgrades.erc1967.getImplementationAddress(
        await fsfiPool.getAddress()
      ),
      "pool proxy",
      await fsfiPool.getAddress()
    );

    const MockAggr = await hre.ethers.getContractFactory("MockAggregator");
    const mockAggr = await MockAggr.deploy();

    await mockAggr.setPrice(1e8);

    const MockAggr2 = await hre.ethers.getContractFactory("MockAggregator");
    const mockAggr2 = await MockAggr2.deploy();

    const MockSwap = await hre.ethers.getContractFactory("MockSwapRouter");
    const mockSwap = await MockSwap.deploy();

    const MockAavePool = await hre.ethers.getContractFactory("MockAavePool");
    const mockAavePool = await MockAavePool.deploy();

    const MockPoolAddressesProvider = await hre.ethers.getContractFactory(
      "MockPoolAddressesProvider"
    );
    const mockPoolAddressesProvider = await MockPoolAddressesProvider.deploy(
      await mockAavePool.getAddress()
    );

    const FSFILoan = await hre.ethers.getContractFactory("FSFILoan");
    const fsfiLoan = await FSFILoan.deploy();

    const FSFI = await hre.ethers.getContractFactory("FSFI");
    const fsfi = await hre.upgrades.deployProxy(
      FSFI,
      [
        [await usdc.getAddress()],
        [await mockAggr.getAddress()],
        [await fsfiPool.getAddress()],
        [await link.getAddress()],
        [await mockAggr2.getAddress()],
        [await aToken.getAddress()],
        [await mockPoolAddressesProvider.getAddress()],
        7000,
        7500,
        await fsfiLoan.getAddress(),
      ],
      { initializer: "initialize" }
    );

    await fsfi.setPlatformAddress(liquidator, platform);
    await fsfiPool.setFSFI(await fsfi.getAddress());
    await fsfi.setSwapRouter(await mockSwap.getAddress());

    await link.transfer(borrower1, BigInt(10000e18));
    await link.transfer(borrower2, BigInt(20000e18));
    await link.transfer(borrower3, BigInt(30000e18));

    await usdc.transfer(lender1, BigInt(10000e18));
    await usdc.transfer(lender2, BigInt(20000e18));
    await usdc.transfer(lender3, BigInt(30000e18));

    await usdc.transfer(borrower1, BigInt(1000e18));
    await usdc.transfer(borrower2, BigInt(2000e18));
    await usdc.transfer(borrower3, BigInt(3000e18));

    return {
      usdc,
      link,
      fsfiPool,
      fsfi,
      owner,
      borrower1,
      borrower2,
      borrower3,
      lender1,
      lender2,
      lender3,
      mockAggr,
      aToken,
      mockAggr2,
    };
  }

  describe("Initialization", () => {
    it("Should initialize correctly", async () => {
      // TODO: test method initialize()
    });

    it("Should only allow owner to set FSFI address", async () => {
      // TODO: test method setFSFI()
    });
  });

  describe("Functionality", () => {
    it("Should withdraw loan successfully", async () => {
      // TODO: test method withdrawLoan()
    });

    it("Should supply successfully", async () => {
      // TODO: test method supply()
    });

    it("Should withdraw successfully", async () => {
      // TODO: test method swapTokenForUSD()
    });

    it("Should borrow successfully", async () => {
      // TODO: test method borrow()
    });

    it("Should repay successfully", async () => {
      // TODO: test method repay()
    });

    it("Should liquidate penalty successfully", async () => {
      // TODO: test method liquidatePenalty()
    });
  });

  describe("Get info", () => {
    it("Should get remaining in pool", async () => {
      // TODO: test method getRemainingPool()
    });

    it("Should get debt in pool", async () => {
      // TODO: test method getDebtPool()
    });

    it("Should get current loan", async () => {
      // TODO: test method getCurrentLoan()
    });

    it("Should get current rate", async () => {
      // TODO: test method getCurrentRate()
    });

    it("Should get total supply", async () => {
      // TODO: test method getTotalSupply()
    });
  });
});
