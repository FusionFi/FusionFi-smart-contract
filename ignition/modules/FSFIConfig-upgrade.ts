import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const FSFIConfigUpgradeModule = buildModule("FSFIConfigUpgradeModule", (m) => {
  const proxyAdminOwner = m.getAccount(0);
  console.log(proxyAdminOwner);

  const fsfi = m.contract("FSFIConfig");

  const data = "0x";

  const proxy = m.contractAt(
    "TransparentUpgradeableProxy",
    "0x79007D349696AF8D1D5b59696B70b43a27e47f70"
  );

  const proxyAdmin = m.contractAt(
    "ProxyAdmin",
    "0x902fbDe26B78248969417aB46B0832e08c4d865c"
  );

  m.call(proxyAdmin, "upgradeAndCall", [proxy, fsfi, data]);

  return { proxyAdmin, proxy };
});

export default FSFIConfigUpgradeModule;
