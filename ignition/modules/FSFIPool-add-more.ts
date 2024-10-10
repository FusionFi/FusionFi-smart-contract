import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const ProxyAddMorePoolFSFIModule = buildModule(
  "ProxyAddMorePoolFSFIModule",
  (m) => {
    let fsfi = "0xDD20c2e2cf399Cc3c688a0A73241B8e8eA7b6F78";

    let usdt = "0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0";
    const usdtAggr = m.contractAt(
      "MockAggregator",
      "0xeEFaa85D124556d8be8a26e4F44cE090d2e707eD",
      { id: "usdtAggr" }
    );

    const defaultReserveInterestRateStrategy = m.contractAt(
      "DefaultReserveInterestRateStrategy",
      "0xEC804ffb70aE9aeF7a885bd6C4cAe8a5b65a7C77"
    );

    const proxyAdminOwner = m.getAccount(0);

    const FSFIPool = m.contract("FSFIPool");

    const dataPool = m.encodeFunctionCall(FSFIPool, "initialize", [
      usdt,
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

    const proxyFSFI = m.contractAt("TransparentUpgradeableProxy", fsfi, {
      id: "proxyFSFL",
    });

    const fsfiPoolProxyRemap = m.contractAt("fsfiPool", proxyPool, {
      id: "fsfiPoolProxyRemap",
    });
    const fsfiProxyRemap = m.contractAt("FSFI", proxyFSFI, {
      id: "fsfiProxyRemap",
    });

    m.call(fsfiPoolProxyRemap, "setFSFI", [fsfiProxyRemap]);

    m.call(fsfiProxyRemap, "setPools", [
      [usdt],
      [usdtAggr],
      [fsfiPoolProxyRemap],
    ]);

    return { proxyFSFI, proxyAdminPool, proxyPool };
  }
);

export default ProxyAddMorePoolFSFIModule;
