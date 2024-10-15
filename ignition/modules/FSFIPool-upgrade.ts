import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const FSFIPoolUpgradeModule = buildModule("FSFIPoolUpgradeModule1", (m) => {
  const proxyAdminOwner = m.getAccount(0);
  console.log(proxyAdminOwner);

  const fsfiPool = m.contract("FSFIPool");

  const data = "0x";

  const proxy = m.contractAt(
    "TransparentUpgradeableProxy",
    "0x72C038736F191e0868A05bFD6e0a6D6DFE8c0A3C"
  );

  const proxyAdmin = m.contractAt(
    "ProxyAdmin",
    "0x5BA20F8fAF3Fa805CE0A63152d0c9B93B2f3640e"
  );

  m.call(proxyAdmin, "upgradeAndCall", [proxy, fsfiPool, data]);

  return { proxyAdmin, proxy };
});

export default FSFIPoolUpgradeModule;
