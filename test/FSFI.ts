import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseUnits } from "ethers";

describe("FSFI system", function () {
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
      encryptus,
    ] = await hre.ethers.getSigners();

    const WETH9 = await hre.ethers.getContractFactory("WETH9");
    const wETH9 = await WETH9.deploy();

    const USDC = await hre.ethers.getContractFactory("MyERC20");
    const usdc = await USDC.deploy("USDC", "USDC");

    const USDT = await hre.ethers.getContractFactory("MyERC20");
    const usdt = await USDT.deploy("USDT", "USDT");

    const WBTC = await hre.ethers.getContractFactory("MyERC20");
    const wBTC = await WBTC.deploy("WBTC", "WBTC");

    const ATOKEN = await hre.ethers.getContractFactory("MyERC20");
    const aToken = await ATOKEN.deploy("ATOKEN", "ATOKEN");

    const AWBTC = await hre.ethers.getContractFactory("MyERC20");
    const aWBTC = await AWBTC.deploy("AWBTC", "AWBTC");

    const AWETH = await hre.ethers.getContractFactory("MyERC20");
    const aWETH = await AWETH.deploy("AWETH", "AWETH");

    const DefaultReserveInterestRateStrategy =
      await hre.ethers.getContractFactory("DefaultReserveInterestRateStrategy");
    const defaultReserveInterestRateStrategy =
      await DefaultReserveInterestRateStrategy.deploy(
        parseUnits("0.80", 27).toString(),
        parseUnits("0.05", 27).toString(),
        parseUnits("0.04", 27).toString(),
        parseUnits("3", 27).toString()
      );

    console.log(
      await defaultReserveInterestRateStrategy.getBaseVariableBorrowRate(),
      await defaultReserveInterestRateStrategy.getVariableRateSlope1(),
      await defaultReserveInterestRateStrategy.getVariableRateSlope2(),
      await defaultReserveInterestRateStrategy.getMaxVariableBorrowRate()
    );

    const FSFIPool = await hre.ethers.getContractFactory("FSFIPool");
    const fsfiPool = await hre.upgrades.deployProxy(
      FSFIPool,
      [
        await usdc.getAddress(),
        await defaultReserveInterestRateStrategy.getAddress(),
        BigInt(1000000000e18),
        encryptus.address,
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

    const FSFIPool2 = await hre.ethers.getContractFactory("FSFIPool");
    const fsfiPool2 = await hre.upgrades.deployProxy(
      FSFIPool2,
      [
        await usdt.getAddress(),
        await defaultReserveInterestRateStrategy.getAddress(),
        BigInt(1000000000e18),
        encryptus.address,
      ],
      { initializer: "initialize" }
    );

    const MockAggrUSDC = await hre.ethers.getContractFactory("MockAggregator");
    const mockAggrUSDC = await MockAggrUSDC.deploy();

    await mockAggrUSDC.setPrice(1e8);

    const MockAggrUSDT = await hre.ethers.getContractFactory("MockAggregator");
    const mockAggrUSDT = await MockAggrUSDT.deploy();

    await mockAggrUSDT.setPrice(1.1e8);

    const MockAggrWBTC = await hre.ethers.getContractFactory("MockAggregator");
    const mockAggrWBTC = await MockAggrWBTC.deploy();

    await mockAggrWBTC.setPrice(60000e8);

    const MockAggrWETH = await hre.ethers.getContractFactory("MockAggregator");
    const mockAggrWETH = await MockAggrWETH.deploy();

    await mockAggrWETH.setPrice(4000e8);

    const MockAggr2 = await hre.ethers.getContractFactory("MockAggregator");
    const mockAggr2 = await MockAggr2.deploy();

    const MockSwap = await hre.ethers.getContractFactory("MockSwapRouter");
    const mockSwap = await MockSwap.deploy();

    const MockAavePool = await hre.ethers.getContractFactory("MockAavePool");
    const mockAavePool = await MockAavePool.deploy();

    const MockPoolAddressesProvider = await hre.ethers.getContractFactory(
      "MockPoolAddressesProvider"
    );
    const mockPoolAddressesProvider = await MockPoolAddressesProvider.deploy();

    console.log("mockAavePool", await mockAavePool.getAddress());
    await mockPoolAddressesProvider.setPool(await mockAavePool.getAddress());

    const MockUniPool = await hre.ethers.getContractFactory("MockPool");
    const mockUniPool = await MockUniPool.deploy();

    const MockUniFactory = await hre.ethers.getContractFactory("MockFactory");
    const mockUniFactory = await MockUniFactory.deploy();

    mockUniFactory.setPool(mockUniPool);

    const MockUniQuoter = await hre.ethers.getContractFactory("MockQuoter");
    const mockUniQuoter = await MockUniQuoter.deploy();

    const MockSwapWBTC = await hre.ethers.getContractFactory("MockSwapRouter");
    const mockSwapWBTC = await MockSwapWBTC.deploy();

    const FSFILoan = await hre.ethers.getContractFactory("FSFILoan");
    const fsfiLoan = await FSFILoan.deploy();

    const FSFIConfig = await hre.ethers.getContractFactory("FSFIConfig");
    const fsfiConfig = await hre.upgrades.deployProxy(
      FSFIConfig,
      [
        7000,
        7500,
        await mockSwap.getAddress(),
        await mockUniFactory.getAddress(),
        await mockUniQuoter.getAddress(),
        await mockPoolAddressesProvider.getAddress(""),
        await liquidator.getAddress(),
        await platform.getAddress(),
        true,
        await wETH9.getAddress(),
      ],
      { initializer: "initialize" }
    );
    const FSFI = await hre.ethers.getContractFactory("FSFI");
    const fsfi = await hre.upgrades.deployProxy(
      FSFI,
      [
        [await usdc.getAddress()],
        [await fsfiPool.getAddress()],
        await fsfiConfig.getAddress(),
        await fsfiLoan.getAddress(),
      ],
      { initializer: "initialize" }
    );

    await fsfiConfig.setPenalty(BigInt(50), BigInt(100), BigInt(50));
    await fsfiConfig.setEarnShare(7000, 2000, 1000);

    await fsfiConfig.setCollaterals(
      [await wBTC.getAddress(), await wETH9.getAddress()],
      [await mockAggrWBTC.getAddress(), await mockAggrWETH.getAddress()],
      [await aWBTC.getAddress(), await aWETH.getAddress()]
    );

    await fsfiConfig.setPoolCoins(
      [await usdc.getAddress(), await usdt.getAddress()],
      [await mockAggrUSDC.getAddress(), await mockAggrUSDT.getAddress()]
    );

    await fsfiConfig.setCollateralToStableFee(
      [
        await wBTC.getAddress(),
        await wBTC.getAddress(),
        await wETH9.getAddress(),
        await wETH9.getAddress(),
      ],
      [
        await usdc.getAddress(),
        await usdt.getAddress(),
        await usdc.getAddress(),
        await usdt.getAddress(),
      ],
      [3000, 3000, 3000, 3000]
    );

    await fsfiPool.setFSFI(await fsfi.getAddress());
    await fsfiPool2.setFSFI(await fsfi.getAddress());

    await wBTC.transfer(borrower1, BigInt(10000e18));
    await wBTC.transfer(borrower2, BigInt(20000e18));
    await wBTC.transfer(borrower3, BigInt(30000e18));

    await usdc.transfer(lender1, BigInt(10000e18));
    await usdc.transfer(lender2, BigInt(20000e18));
    await usdc.transfer(lender3, BigInt(30000e18));

    await usdc.transfer(borrower1, BigInt(1000e18));
    await usdc.transfer(borrower2, BigInt(2000e18));
    await usdc.transfer(borrower3, BigInt(3000e18));

    return {
      usdc,
      wBTC,
      fsfiPool,
      fsfi,
      owner,
      borrower1,
      borrower2,
      borrower3,
      lender1,
      lender2,
      lender3,
      mockAggrUSDC,
      aToken,
      mockAggr2,
      wETH9,
      mockAggrWBTC,
    };
  }

  describe("Lending", function () {
    it("Should get loan fund at over 80% pool", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
      } = await loadFixture(deployFixture);

      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(1100e18));
      await fsfiPool.connect(lender1).supply(BigInt(1100e18));
      await time.increase(30 * 24 * 3600);
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );
      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());
      // borrower
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(500e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(950e18),
          await usdc.getAddress(),
          BigInt(500e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );

      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());
      await time.increase(300 * 24 * 3600);
      // borrower
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(300e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(80e18),
          await usdc.getAddress(),
          BigInt(300e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );

      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(200e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(40e18),
          await usdc.getAddress(),
          BigInt(200e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );
    });

    it("Should get loan fund", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));
      await time.increase(30 * 24 * 3600);
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );
      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());
      // borrower
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(1000e18),
          await usdc.getAddress(),
          BigInt(1000e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );

      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());
      await time.increase(300 * 24 * 3600);
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );
      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());
      // lender deposit USDC
      await usdc
        .connect(lender2)
        .approve(fsfiPool.getAddress(), BigInt(20000e18));
      await fsfiPool.connect(lender2).supply(BigInt(20000e18));
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );
      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());
      await time.increase(90 * 24 * 3600);
      // borrower
      await wBTC.connect(borrower2).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower2)
        .createLoan(
          BigInt(2000e18),
          await usdc.getAddress(),
          BigInt(1000e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );
      await time.increase(180 * 24 * 3600);
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );
      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());

      expect(BigInt(await usdc.balanceOf(borrower1)).toString()).to.eq(
        BigInt(2000e18)
      );
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );
      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());
      // borrower
      await usdc.connect(borrower1).approve(fsfi.getAddress(), BigInt(10e18));
      await time.increase(30 * 24 * 3600);
      // close loan
      await usdc.connect(borrower1).approve(fsfi.getAddress(), BigInt(2000e18));
      await fsfi
        .connect(borrower1)
        .repayLoan(1, BigInt(2000e18), await usdc.getAddress());
      // console.log("remain", (await fsfiPool.getRemainingPool()) / BigInt(1e18));
      // console.log(
      //   "total supply",
      //   (await fsfiPool.getTotalSupply()) / BigInt(1e18)
      // );
      // console.log(
      //   "coin in sc",
      //   (await usdc.balanceOf(await fsfiPool.getAddress())) / BigInt(1e18)
      // );
      // console.log("debt", (await fsfiPool.getDebtPool()) / BigInt(1e18));
      // console.log("rate", await fsfiPool.getCurrentRate());
      await fsfi.connect(borrower1).withdrawAllCollateral(BigInt(1), false);
    });

    it("Should get back collateral", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));

      // borrower lend
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(1000e18),
          await usdc.getAddress(),
          BigInt(900e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );

      await time.increase(30 * 24 * 3600);

      expect(BigInt(await usdc.balanceOf(borrower1)).toString()).to.eq(
        BigInt(2000e18)
      );

      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(100e18));
      await fsfi
        .connect(borrower1)
        .addCollateral(BigInt(1), BigInt(100e18), await wBTC.getAddress());
      // borrower return monthly payment
      await usdc.connect(borrower1).approve(fsfi.getAddress(), BigInt(10e18));
      await time.increase(30 * 24 * 3600);
      // close loan
      let debt = await fsfiPool.getCurrentLoan(BigInt(1));
      await usdc.connect(borrower1).approve(fsfi.getAddress(), BigInt(1100e18));
      await fsfi
        .connect(borrower1)
        .repayLoan(
          1,
          (BigInt(debt) * BigInt(101)) / BigInt(100),
          await usdc.getAddress()
        );
      let debt1 = await fsfiPool.getCurrentLoan(BigInt(1));
      expect(debt1 == BigInt(0), "Can not close loan");
    });

    it("multi lender", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));

      await usdc
        .connect(lender2)
        .approve(fsfiPool.getAddress(), BigInt(20000e18));
      await fsfiPool.connect(lender2).supply(BigInt(20000e18));

      // borrower lend
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(1000e18),
          await usdc.getAddress(),
          BigInt(1000e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );

      expect(BigInt(await usdc.balanceOf(borrower1)).toString()).to.eq(
        BigInt(2000e18)
      );

      // borrower return monthly payment
      await usdc.connect(borrower1).approve(fsfi.getAddress(), BigInt(10e18));
      await time.increase(30 * 24 * 3600);
      // close loan
      await usdc.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .repayLoan(1, BigInt(1000e18), await usdc.getAddress());
    });

    it("withdraw all USDC", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));
      await fsfiPool.connect(lender1).withdraw(BigInt(10000e18));
    });

    it("deposit more USDC", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(5000e18));
      await fsfiPool.connect(lender1).supply(BigInt(5000e18));
    });
  });
  describe("ETH", function () {
    it("Should get loan fund", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));
      // borrower lend
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(950e18),
          await usdc.getAddress(),
          BigInt(500e18),
          await wBTC.getAddress(),
          true,
          false,
          "0x000000000000000000000001"
        );
    });

    it("Should get loan fund by ETH", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
        mockAggrUSDC,
        aToken,
        mockAggr2,
        wETH9,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));
      // borrower lend
      // await  wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .createLoanByETH(
          BigInt(1000e18),
          await usdc.getAddress(),
          BigInt(5e18),
          true,
          false,
          "0x000000000000000000000000",
          { value: parseUnits("5", 18).toString() }
        );

      await fsfi.addCollateralByETH(BigInt(1), BigInt(2e18), {
        value: parseUnits("2", 18).toString(),
      });

      console.log(
        await fsfiPool.getTotalSupply(),
        await fsfiPool.getDebtPool(),
        await fsfiPool.getCurrentRate()
      );
    });
  });
  describe("Liquidation", function () {
    it("Good Health factor", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));
      // borrower lend
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(1000e18),
          await usdc.getAddress(),
          BigInt(1000e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );

      expect(BigInt(await usdc.balanceOf(borrower1)).toString()).to.eq(
        BigInt(2000e18)
      );
      // console.log(await fsfi.getHealthFactor(BigInt(1)));
      expect(await fsfi.getHealthFactor(BigInt(1))).to.greaterThanOrEqual(100);
    });

    it("Bad Health factor", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
        mockAggrUSDC,
        aToken,
        mockAggr2,
        wETH9,
        mockAggrWBTC,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));
      // borrower lend
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(1000e18),
          await usdc.getAddress(),
          BigInt(1000e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );

      expect(BigInt(await usdc.balanceOf(borrower1)).toString()).to.eq(
        BigInt(2000e18)
      );
      await mockAggrWBTC.setPrice(BigInt(10000));
      await mockAggr2.setPrice(BigInt(10000));

      expect(await fsfi.getHealthFactor(BigInt(1))).to.lessThan(100);
    });

    it("Bad Health factor liquidation", async function () {
      const {
        usdc,
        wBTC,
        fsfiPool,
        fsfi,
        owner,
        borrower1,
        borrower2,
        borrower3,
        lender1,
        lender2,
        lender3,
        mockAggrUSDC,
        aToken,
        mockAggr2,
        wETH9,
        mockAggrWBTC,
      } = await loadFixture(deployFixture);
      // lender deposit USDC
      await usdc
        .connect(lender1)
        .approve(fsfiPool.getAddress(), BigInt(10000e18));
      await fsfiPool.connect(lender1).supply(BigInt(10000e18));
      // borrower lend
      await wBTC.connect(borrower1).approve(fsfi.getAddress(), BigInt(1000e18));
      await fsfi
        .connect(borrower1)
        .createLoan(
          BigInt(1000e18),
          await usdc.getAddress(),
          BigInt(1000e18),
          await wBTC.getAddress(),
          false,
          false,
          "0x000000000000000000000000"
        );

      expect(BigInt(await usdc.balanceOf(borrower1)).toString()).to.eq(
        BigInt(2000e18)
      );
      await mockAggrWBTC.setPrice(BigInt(10000));
      await mockAggr2.setPrice(BigInt(10000));

      // expect(await fsfi.getHealthFactor(BigInt(1))).to.lessThan(100);

      await aToken.transfer(
        await fsfi.getLoanAddress(BigInt(1)),
        BigInt(60e18)
      );
      await wBTC.transfer(borrower1, BigInt(60e18));
      let loanAddr = await fsfi.getLoanAddress(BigInt(1));
      await usdc.transfer(loanAddr, BigInt(1210e18));
      await fsfi.liquidate(BigInt(1));
    });
  });
});
