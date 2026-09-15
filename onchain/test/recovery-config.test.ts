import { expect } from "chai";
import { parsePartialDeploymentRecord } from "../scripts/recovery-config";

const RECORD = {
  status: "partial",
  architecture: "moonball-v1",
  network: "baseSepolia",
  deployer: "0x0000000000000000000000000000000000000001",
  usdc: "0x0000000000000000000000000000000000000002",
  oracle: "0x0000000000000000000000000000000000000003",
  owner: "0x0000000000000000000000000000000000000001",
  updater: "0x0000000000000000000000000000000000000001",
  staleness: 14400,
  recipient: "0x0000000000000000000000000000000000000001",
  safe: null,
  oracleTransactionHash: `0x${"ab".repeat(32)}`,
  oracleDeploymentNonce: 12,
  oracleDeploymentBlock: 123,
  oracleReceiptStatus: 1,
  recordedAt: "2026-09-10T00:00:00.000Z",
  failure: "RPC read failed after the oracle receipt.",
};

describe("partial deployment recovery record", () => {
  it("normalizes a valid Base Sepolia partial record", () => {
    const parsed = parsePartialDeploymentRecord(RECORD, "baseSepolia");
    expect(parsed.oracle).to.equal("0x0000000000000000000000000000000000000003");
    expect(parsed.oracleDeploymentNonce).to.equal(12);
    expect(parsed.safe).to.equal(null);
  });

  it("rejects recovered or wrong-network records", () => {
    expect(() =>
      parsePartialDeploymentRecord({ ...RECORD, status: "recovered" }, "baseSepolia")
    ).to.throw("status partial");
    expect(() => parsePartialDeploymentRecord(RECORD, "base")).to.throw(
      "network must be base"
    );
  });

  it("rejects invalid addresses and transaction hashes", () => {
    expect(() =>
      parsePartialDeploymentRecord({ ...RECORD, oracle: "not-an-address" }, "baseSepolia")
    ).to.throw("oracle must be a valid address");
    expect(() =>
      parsePartialDeploymentRecord(
        { ...RECORD, oracleTransactionHash: "0x1234" },
        "baseSepolia"
      )
    ).to.throw("must be a transaction hash");
  });

  it("requires a successful receipt and bounded staleness", () => {
    expect(() =>
      parsePartialDeploymentRecord({ ...RECORD, oracleReceiptStatus: 0 }, "baseSepolia")
    ).to.throw("successful status 1");
    expect(() =>
      parsePartialDeploymentRecord({ ...RECORD, staleness: 86401 }, "baseSepolia")
    ).to.throw("must not exceed 86400");
  });
});
