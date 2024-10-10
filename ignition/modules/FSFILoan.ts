import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const FSFILoanModule = buildModule("FSFILoanModule5", (m) => {
  const loan = m.contract("FSFILoan", []);

  return { loan };
});

export default FSFILoanModule;
