import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const proxyfsfiPoolModule = buildModule("ProxyfsfiPoolModule", (m) => {
  const proxyAdminOwner = m.getAccount(0);
  console.log(proxyAdminOwner);

  const fsfiPool = m.contract("FSFIPool");

  const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
  const Strategy = "0xEe285c875Ce67Fee622365a01a23B6369c89d84a";

  const data = m.encodeFunctionCall(fsfiPool, "initialize", [
    USDC,
    Strategy,
    100000000000000,
  ]);

  const proxy = m.contract("TransparentUpgradeableProxy", [
    fsfiPool,
    proxyAdminOwner,
    data,
  ]);

  const proxyAdminAddress = m.readEventArgument(
    proxy,
    "AdminChanged",
    "newAdmin"
  );

  const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress);

  return { proxyAdmin, proxy };
});

export default proxyfsfiPoolModule;
