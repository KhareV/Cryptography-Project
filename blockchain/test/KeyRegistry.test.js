const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoChatKeyRegistry", function () {
  let keyRegistry;
  let owner;
  let alice;
  let bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CryptoChatKeyRegistry");
    keyRegistry = await Factory.deploy();
    await keyRegistry.waitForDeployment();
  });

  it("Register a key and return correct data from getKey", async function () {
    await expect(
      keyRegistry
        .connect(alice)
        .registerKey("user-1", "pubKey-1", "fingerprint-1"),
    ).to.emit(keyRegistry, "KeyRegistered");

    const data = await keyRegistry.getKey("user-1");
    expect(data.publicKey).to.equal("pubKey-1");
    expect(data.fingerprint).to.equal("fingerprint-1");
    expect(data.revoked).to.equal(false);
    expect(data.registeredAt).to.be.gt(0);
    expect(data.registeredBy).to.equal(alice.address);
  });

  it("Allow same wallet to update same userId", async function () {
    await keyRegistry
      .connect(alice)
      .registerKey("user-1", "pubKey-1", "fingerprint-1");

    const first = await keyRegistry.getKey("user-1");

    await keyRegistry
      .connect(alice)
      .registerKey("user-1", "pubKey-2", "fingerprint-2");

    const second = await keyRegistry.getKey("user-1");
    expect(second.publicKey).to.equal("pubKey-2");
    expect(second.fingerprint).to.equal("fingerprint-2");
    expect(second.registeredAt).to.equal(first.registeredAt);
    expect(second.registeredBy).to.equal(alice.address);
  });

  it("Reject update from a different wallet", async function () {
    await keyRegistry
      .connect(alice)
      .registerKey("user-1", "pubKey-1", "fingerprint-1");

    await expect(
      keyRegistry
        .connect(bob)
        .registerKey("user-1", "pubKey-hijack", "fingerprint-hijack"),
    ).to.be.revertedWith("only key owner can update");
  });

  it("Allow owner wallet to revoke and mark as unregistered", async function () {
    await keyRegistry
      .connect(alice)
      .registerKey("user-1", "pubKey-1", "fingerprint-1");

    await expect(keyRegistry.connect(alice).revokeKey("user-1")).to.emit(
      keyRegistry,
      "KeyRevoked",
    );

    expect(await keyRegistry.isRegistered("user-1")).to.equal(false);
  });

  it("Reject revoke from non-owner wallet", async function () {
    await keyRegistry
      .connect(alice)
      .registerKey("user-1", "pubKey-1", "fingerprint-1");

    await expect(
      keyRegistry.connect(bob).revokeKey("user-1"),
    ).to.be.revertedWith("only key owner");
  });

  it("Return correct userIds from getKeysByWallet", async function () {
    await keyRegistry
      .connect(alice)
      .registerKey("user-1", "pubKey-1", "fingerprint-1");
    await keyRegistry
      .connect(alice)
      .registerKey("user-2", "pubKey-2", "fingerprint-2");

    const ids = await keyRegistry.getKeysByWallet(alice.address);
    expect(ids).to.deep.equal(["user-1", "user-2"]);
  });

  it("Pause should block registerKey and unpause should restore it", async function () {
    await keyRegistry.connect(owner).pause();

    await expect(
      keyRegistry
        .connect(alice)
        .registerKey("user-1", "pubKey-1", "fingerprint-1"),
    ).to.be.reverted;

    await keyRegistry.connect(owner).unpause();

    await keyRegistry
      .connect(alice)
      .registerKey("user-1", "pubKey-1", "fingerprint-1");

    expect(await keyRegistry.isRegistered("user-1")).to.equal(true);
  });
});
