const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoChatAnchor", function () {
  let anchor;
  let owner;
  let backend;
  let attacker;

  beforeEach(async function () {
    [owner, backend, attacker] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CryptoChatAnchor");
    anchor = await Factory.deploy();
    await anchor.waitForDeployment();
  });

  it("Revert when unauthorized wallet attempts to anchor", async function () {
    await expect(
      anchor.connect(attacker).anchor("conv-1", "root-1", 10),
    ).to.be.revertedWith("not authorized anchorer");
  });

  it("Authorize wallet and allow anchoring", async function () {
    await anchor.connect(owner).addAuthorizedAnchorer(backend.address);

    await expect(
      anchor.connect(backend).anchor("conv-1", "root-1", 10),
    ).to.emit(anchor, "Anchored");

    const latest = await anchor.getLatestAnchor("conv-1");
    expect(latest.merkleRoot).to.equal("root-1");
    expect(latest.messageCount).to.equal(10n);
    expect(latest.anchoredBy).to.equal(backend.address);
  });

  it("getLatestAnchor returns the most recent anchor", async function () {
    await anchor.connect(owner).addAuthorizedAnchorer(backend.address);

    await anchor.connect(backend).anchor("conv-2", "root-old", 5);
    await anchor.connect(backend).anchor("conv-2", "root-new", 8);

    const latest = await anchor.getLatestAnchor("conv-2");
    expect(latest.merkleRoot).to.equal("root-new");
    expect(latest.messageCount).to.equal(8n);
  });

  it("getAnchorHistory returns all records in insertion order", async function () {
    await anchor.connect(owner).addAuthorizedAnchorer(backend.address);

    await anchor.connect(backend).anchor("conv-3", "root-a", 2);
    await anchor.connect(backend).anchor("conv-3", "root-b", 4);
    await anchor.connect(backend).anchor("conv-3", "root-c", 6);

    const history = await anchor.getAnchorHistory("conv-3");
    expect(history.length).to.equal(3);
    expect(history[0].merkleRoot).to.equal("root-a");
    expect(history[1].merkleRoot).to.equal("root-b");
    expect(history[2].merkleRoot).to.equal("root-c");
  });

  it("Store multiple anchors for same conversation", async function () {
    await anchor.connect(owner).addAuthorizedAnchorer(backend.address);

    await anchor.connect(backend).anchor("conv-4", "root-1", 3);
    await anchor.connect(backend).anchor("conv-4", "root-2", 6);

    const count = await anchor.getAnchorCount("conv-4");
    expect(count).to.equal(2n);
  });

  it("Removed anchorer can no longer anchor", async function () {
    await anchor.connect(owner).addAuthorizedAnchorer(backend.address);
    await anchor.connect(backend).anchor("conv-5", "root-1", 1);

    await anchor.connect(owner).removeAuthorizedAnchorer(backend.address);

    await expect(
      anchor.connect(backend).anchor("conv-5", "root-2", 2),
    ).to.be.revertedWith("not authorized anchorer");
  });
});
