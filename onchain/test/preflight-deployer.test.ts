import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { resolvePreflightDeployer } from "../scripts/preflight-deployer";

const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const OTHER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

describe("read-only preflight deployer resolution", () => {
  it("accepts a public address without a signer or private key", () => {
    expect(resolvePreflightDeployer(DEPLOYER)).to.equal(DEPLOYER);
  });

  it("retains the configured signer fallback", () => {
    expect(resolvePreflightDeployer(undefined, DEPLOYER)).to.equal(DEPLOYER);
    expect(resolvePreflightDeployer("", DEPLOYER)).to.equal(DEPLOYER);
  });

  it("normalizes addresses and accepts a matching signer", () => {
    expect(resolvePreflightDeployer(` ${DEPLOYER.toLowerCase()} `, DEPLOYER)).to.equal(DEPLOYER);
  });

  it("rejects a mismatch with the configured signer", () => {
    expect(() => resolvePreflightDeployer(DEPLOYER, OTHER)).to.throw("does not match");
  });

  it("asks for a public address when neither source exists", () => {
    expect(() => resolvePreflightDeployer()).to.throw("no private key is required");
  });

  it("rejects invalid or zero explicit addresses even if a signer exists", () => {
    for (const invalid of ["not-an-address", ZeroAddress]) {
      expect(() => resolvePreflightDeployer(invalid, DEPLOYER)).to.throw("valid nonzero address");
    }
  });

  it("rejects invalid or zero signer addresses", () => {
    for (const invalid of ["not-an-address", ZeroAddress]) {
      expect(() => resolvePreflightDeployer(DEPLOYER, invalid)).to.throw("valid nonzero address");
    }
  });
});
