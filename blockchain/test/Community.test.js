const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoChatCommunity", function () {
  let community;
  let owner;
  let admin;
  let memberA;
  let memberB;

  beforeEach(async function () {
    [owner, admin, memberA, memberB] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CryptoChatCommunity");
    community = await Factory.deploy();
    await community.waitForDeployment();
  });

  it("Create community and verify getCommunity fields", async function () {
    const fee = ethers.parseEther("0.01");
    await expect(
      community.connect(admin).createCommunity("group-1", fee),
    ).to.emit(community, "CommunityCreated");

    const data = await community.getCommunity("group-1");
    expect(data.joinFeeWei).to.equal(fee);
    expect(data.memberCount).to.equal(1n);
    expect(data.admin).to.equal(admin.address);
    expect(data.pendingWithdrawal).to.equal(0n);
    expect(data.totalFeesCollected).to.equal(0n);
  });

  it("Join free community and mark user as member", async function () {
    await community.connect(admin).createCommunity("group-free", 0);

    await community.connect(memberA).joinCommunity("group-free", { value: 0 });

    expect(await community.isMember("group-free", memberA.address)).to.equal(
      true,
    );

    const info = await community.getCommunity("group-free");
    expect(info.memberCount).to.equal(2n);
  });

  it("Join paid community with exact amount", async function () {
    const fee = ethers.parseEther("0.05");
    await community.connect(admin).createCommunity("group-paid", fee);

    await community
      .connect(memberA)
      .joinCommunity("group-paid", { value: fee });

    const membership = await community.getMembership(
      "group-paid",
      memberA.address,
    );
    const details = await community.getCommunity("group-paid");

    expect(membership.memberStatus).to.equal(true);
    expect(membership.paidAmountWei).to.equal(fee);
    expect(details.memberCount).to.equal(2n);
    expect(details.pendingWithdrawal).to.equal(fee);
  });

  it("Join paid community with excess and refund difference", async function () {
    const fee = ethers.parseEther("0.02");
    const excess = ethers.parseEther("0.01");
    await community.connect(admin).createCommunity("group-excess", fee);

    await community
      .connect(memberA)
      .joinCommunity("group-excess", { value: fee + excess });

    const details = await community.getCommunity("group-excess");
    const contractBalance = await ethers.provider.getBalance(
      await community.getAddress(),
    );

    expect(details.pendingWithdrawal).to.equal(fee);
    expect(contractBalance).to.equal(fee);
  });

  it("Revert when joining paid community with insufficient amount", async function () {
    const fee = ethers.parseEther("0.05");
    await community.connect(admin).createCommunity("group-short", fee);

    await expect(
      community
        .connect(memberA)
        .joinCommunity("group-short", { value: fee - 1n }),
    ).to.be.revertedWith("insufficient join fee");
  });

  it("Revert when wallet attempts to join twice", async function () {
    const fee = ethers.parseEther("0.01");
    await community.connect(admin).createCommunity("group-repeat", fee);

    await community
      .connect(memberA)
      .joinCommunity("group-repeat", { value: fee });

    await expect(
      community.connect(memberA).joinCommunity("group-repeat", { value: fee }),
    ).to.be.revertedWith("already joined");
  });

  it("Allow admin to withdraw fees and transfer ETH correctly", async function () {
    const fee = ethers.parseEther("0.03");
    await community.connect(admin).createCommunity("group-withdraw", fee);
    await community
      .connect(memberA)
      .joinCommunity("group-withdraw", { value: fee });

    const before = await ethers.provider.getBalance(admin.address);
    const stateBefore = await community.getCommunity("group-withdraw");

    const tx = await community.connect(admin).withdrawFees("group-withdraw");
    const receipt = await tx.wait();
    const gasCost = receipt.fee ?? 0n;

    const after = await ethers.provider.getBalance(admin.address);
    const stateAfter = await community.getCommunity("group-withdraw");

    expect(after).to.equal(before + stateBefore.pendingWithdrawal - gasCost);
    expect(stateAfter.pendingWithdrawal).to.equal(0n);
  });

  it("Revert withdrawFees for non-admin", async function () {
    const fee = ethers.parseEther("0.03");
    await community.connect(admin).createCommunity("group-withdraw-auth", fee);
    await community
      .connect(memberA)
      .joinCommunity("group-withdraw-auth", { value: fee });

    await expect(
      community.connect(memberA).withdrawFees("group-withdraw-auth"),
    ).to.be.revertedWith("only community admin");
  });

  it("Revert withdrawFees when pendingWithdrawal is zero", async function () {
    await community.connect(admin).createCommunity("group-zero", 0);

    await expect(
      community.connect(admin).withdrawFees("group-zero"),
    ).to.be.revertedWith("no fees to withdraw");
  });

  it("Allow admin to update fee", async function () {
    await community.connect(admin).createCommunity("group-fee", 1000);

    await expect(community.connect(admin).updateFee("group-fee", 2000)).to.emit(
      community,
      "FeeUpdated",
    );

    const state = await community.getCommunity("group-fee");
    expect(state.joinFeeWei).to.equal(2000n);
  });

  it("Revert updateFee for non-admin", async function () {
    await community.connect(admin).createCommunity("group-fee-auth", 1000);

    await expect(
      community.connect(memberA).updateFee("group-fee-auth", 2000),
    ).to.be.revertedWith("only community admin");
  });

  it("Allow admin to remove member", async function () {
    await community.connect(admin).createCommunity("group-remove", 0);
    await community
      .connect(memberA)
      .joinCommunity("group-remove", { value: 0 });

    await expect(
      community.connect(admin).removeMember("group-remove", memberA.address),
    ).to.emit(community, "MemberRemoved");

    expect(await community.isMember("group-remove", memberA.address)).to.equal(
      false,
    );
  });

  it("Revert when admin tries to remove self", async function () {
    await community.connect(admin).createCommunity("group-self", 0);

    await expect(
      community.connect(admin).removeMember("group-self", admin.address),
    ).to.be.revertedWith("cannot remove admin");
  });

  it("Transfer admin and allow new admin to withdraw", async function () {
    const fee = ethers.parseEther("0.02");
    await community.connect(admin).createCommunity("group-admin", fee);
    await community
      .connect(memberA)
      .joinCommunity("group-admin", { value: fee });

    await expect(
      community.connect(admin).transferAdmin("group-admin", memberA.address),
    ).to.emit(community, "AdminTransferred");

    await expect(
      community.connect(memberA).withdrawFees("group-admin"),
    ).to.emit(community, "FeesWithdrawn");

    const state = await community.getCommunity("group-admin");
    expect(state.admin).to.equal(memberA.address);
    expect(state.pendingWithdrawal).to.equal(0n);
  });

  it("Return correct list from getWalletCommunities", async function () {
    await community.connect(admin).createCommunity("group-list-1", 0);
    await community.connect(admin).createCommunity("group-list-2", 0);

    await community
      .connect(memberA)
      .joinCommunity("group-list-1", { value: 0 });
    await community
      .connect(memberA)
      .joinCommunity("group-list-2", { value: 0 });

    const list = await community.getWalletCommunities(memberA.address);
    expect(list).to.deep.equal(["group-list-1", "group-list-2"]);
  });
});
