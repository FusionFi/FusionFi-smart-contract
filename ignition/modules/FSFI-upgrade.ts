import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const FSFIUpgradeModule = buildModule("FSFIUpgradeModule", (m) => {
  const proxyAdminOwner = m.getAccount(0);
  console.log(proxyAdminOwner);

  const fsfi = m.contract("FSFI");

  const data = "0x";

  const proxy = m.contractAt(
    "TransparentUpgradeableProxy",
    "0x847B9D52d563fdF6a8cbc761c6B429741d59F6E1"
  );

  const proxyAdmin = m.contractAt(
    "ProxyAdmin",
    "0xdcAcfeA818cD4191415E91a81d4CE0f45ab5Be24"
  );

  m.call(proxyAdmin, "upgradeAndCall", [proxy, fsfi, data]);

  return { proxyAdmin, proxy };
});

export default FSFIUpgradeModule;
