import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseUnits } from "ethers";
const proxyFSFIModule = buildModule("proxyFSFIModule", (m) => {
  let usdc = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
  let wbtc = "0x29f2D40B0605204364af54EC677bD022dA425d03";
  let wETH = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";
  let aWBTC = "0x1804Bf30507dc2EB3bDEbbbdd859991EAeF6EefF";
  let aWETH = "0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830";
  let PoolAddressesProviderAave = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A";

  const ethAggr = m.contract("MockAggregator", [], { id: "ethAggr" });
  const wbtcAggr = m.contract("MockAggregator", [], { id: "wbtcAggr" });
  const usdcAggr = m.contract("MockAggregator", [], { id: "usdcAggr" });

  m.call(ethAggr, "setPrice", [BigInt(4000e8)]);

  m.call(usdcAggr, "setPrice", [BigInt(1.01e8)]);

  m.call(wbtcAggr, "setPrice", [BigInt(60000e8)]);

  const defaultReserveInterestRateStrategy = m.contract(
    "DefaultReserveInterestRateStrategy",
    [
      parseUnits("0.80", 27).toString(),
      parseUnits("0.05", 27).toString(),
      parseUnits("0.04", 27).toString(),
      parseUnits("3", 27).toString(),
    ]
  );

  const proxyAdminOwner = m.getAccount(0);

  const FSFIPool = m.contract("FSFIPool");

  const dataPool = m.encodeFunctionCall(FSFIPool, "initialize", [
    usdc,
    defaultReserveInterestRateStrategy,
    100000000000000,
  ]);

  const proxyPool = m.contract(
    "TransparentUpgradeableProxy",
    [FSFIPool, proxyAdminOwner, dataPool],
    { id: "proxyPool" }
  );

  const proxyAdminAddressPool = m.readEventArgument(
    proxyPool,
    "AdminChanged",
    "newAdmin",
    { id: "proxyAdminAddressPool" }
  );

  const proxyAdminPool = m.contractAt("ProxyAdmin", proxyAdminAddressPool, {
    id: "proxyAdminPool",
  });

  const loan = m.contract("FSFILoan");

  const fsfi = m.contract("FSFI");

  const data = m.encodeFunctionCall(fsfi, "initialize", [
    [usdc],
    [usdcAggr],
    [proxyPool],
    [wbtc, wETH],
    [wbtcAggr, ethAggr],
    [aWBTC, aWETH],
    PoolAddressesProviderAave,
    BigInt(5000),
    BigInt(7000),
    loan,
  ]);

  const proxyFSFI = m.contract(
    "TransparentUpgradeableProxy",
    [fsfi, proxyAdminOwner, data],
    { id: "proxyFSFI" }
  );

  const proxyAdminAddressFSFI = m.readEventArgument(
    proxyFSFI,
    "AdminChanged",
    "newAdmin",
    { id: "proxyAdminAddressFSFI" }
  );

  const proxyAdminFSFI = m.contractAt("ProxyAdmin", proxyAdminAddressFSFI, {
    id: "proxyAdminFSFI",
  });

  const fsfiPoolProxyRemap = m.contractAt("fsfiPool", proxyPool, {
    id: "fsfiPoolProxyRemap",
  });
  const fsfiProxyRemap = m.contractAt("FSFI", proxyFSFI, {
    id: "fsfiProxyRemap",
  });
  const swapRouterV2 = m.contractAt(
    "MockSwapRouter",
    "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"
  );

  const factoryV3 = m.contractAt(
    "MockFactory",
    "0x0227628f3F023bb0B980b67D528571c95c6DaC1c"
  );

  m.call(fsfiProxyRemap, "setPenalty", [BigInt(50), BigInt(100), BigInt(50)]);

  m.call(fsfiProxyRemap, "setPlatformAddress", [
    proxyAdminOwner,
    proxyAdminOwner,
  ]);

  m.call(fsfiPoolProxyRemap, "setFSFI", [fsfiProxyRemap]);

  m.call(fsfiProxyRemap, "setSwapRouter", [swapRouterV2, factoryV3]);

  m.call(fsfiProxyRemap, "setEarnShare", [
    BigInt(7000),
    BigInt(2000),
    BigInt(1000),
  ]);

  m.call(fsfiProxyRemap, "setEnableETHNative", [true]);

  return { proxyAdminFSFI, proxyFSFI, proxyAdminPool, proxyPool };
});

export default proxyFSFIModule;
