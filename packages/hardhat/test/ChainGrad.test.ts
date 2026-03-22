import { expect } from "chai";
import { ethers } from "hardhat";
import { AccessManager, ChainGradNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ChainGrad System", function () {
  let accessManager: AccessManager;
  let chainGradNFT: ChainGradNFT;
  let admin: SignerWithAddress;
  let university: SignerWithAddress;
  let board: SignerWithAddress;
  let student: SignerWithAddress;
  let stranger: SignerWithAddress;

  const STUDENT_ID = "ZC2020100525";
  const URI = "ipfs://QmTest123";

  beforeEach(async function () {
    [admin, university, board, student, stranger] = await ethers.getSigners();

    const AccessManagerFactory = await ethers.getContractFactory("AccessManager");
    accessManager = await AccessManagerFactory.deploy();
    await accessManager.waitForDeployment();

    const ChainGradNFTFactory = await ethers.getContractFactory("ChainGradNFT");
    chainGradNFT = await ChainGradNFTFactory.deploy(await accessManager.getAddress());
    await chainGradNFT.waitForDeployment();
  });

  describe("AccessManager", function () {
    it("Deployer is admin", async function () {
      expect(await accessManager.isAdmin(admin.address)).to.be.true;
    });

    it("Can authorize and revoke university", async function () {
      await accessManager.connect(admin).authorizeUniversity(university.address);
      const uniRole = await accessManager.UNIVERSITY_ROLE();
      expect(await accessManager.hasRole(uniRole, university.address)).to.be.true;

      await accessManager.connect(admin).revokeUniversity(university.address);
      expect(await accessManager.hasRole(uniRole, university.address)).to.be.false;
    });

    it("Can authorize and revoke scholarship board", async function () {
      await accessManager.connect(admin).authorizeScholarshipBoard(board.address);
      const boardRole = await accessManager.SCHOLARSHIP_BOARD_ROLE();
      expect(await accessManager.hasRole(boardRole, board.address)).to.be.true;

      await accessManager.connect(admin).revokeScholarshipBoard(board.address);
      expect(await accessManager.hasRole(boardRole, board.address)).to.be.false;
    });

    it("Admin can pause and unpause", async function () {
      await accessManager.connect(admin).pause();
      expect(await accessManager.paused()).to.be.true;

      await accessManager.connect(admin).unpause();
      expect(await accessManager.paused()).to.be.false;
    });

    it("Non-admin cannot pause", async function () {
      await expect(accessManager.connect(stranger).pause()).to.be.revertedWithCustomError(
        accessManager,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("ChainGradNFT - Minting", function () {
    beforeEach(async function () {
      await accessManager.connect(admin).authorizeUniversity(university.address);
    });

    it("University can mint degree", async function () {
      await expect(chainGradNFT.connect(university).mintDegree(student.address, STUDENT_ID, URI))
        .to.emit(chainGradNFT, "DegreeMinted")
        .withArgs(1, student.address, university.address, STUDENT_ID);

      expect(await chainGradNFT.ownerOf(1)).to.equal(student.address);
      expect(await chainGradNFT.tokenURI(1)).to.equal(URI);
    });

    it("Stranger cannot mint", async function () {
      await expect(
        chainGradNFT.connect(stranger).mintDegree(student.address, "TEST", URI)
      ).to.be.revertedWithCustomError(chainGradNFT, "NotAuthorized");
    });

    it("Minting rejects duplicate student IDs", async function () {
      await chainGradNFT.connect(university).mintDegree(student.address, STUDENT_ID, URI);
      await expect(
        chainGradNFT.connect(university).mintDegree(student.address, STUDENT_ID, URI)
      ).to.be.revertedWithCustomError(chainGradNFT, "StudentIdAlreadyUsed");
    });
  });

  describe("ChainGradNFT - Soulbound", function () {
    beforeEach(async function () {
      await accessManager.connect(admin).authorizeUniversity(university.address);
      await chainGradNFT.connect(university).mintDegree(student.address, STUDENT_ID, URI);
    });

    it("transferFrom reverts", async function () {
      await expect(
        chainGradNFT.connect(student).transferFrom(student.address, stranger.address, 1)
      ).to.be.revertedWithCustomError(chainGradNFT, "Soulbound");
    });

    it("approve has no transfer effect", async function () {
      await chainGradNFT.connect(student).approve(stranger.address, 1);
      await expect(
        chainGradNFT.connect(stranger).transferFrom(student.address, stranger.address, 1)
      ).to.be.revertedWithCustomError(chainGradNFT, "Soulbound");
    });
  });

  describe("ChainGradNFT - Revocation", function () {
    beforeEach(async function () {
      await accessManager.connect(admin).authorizeUniversity(university.address);
      await chainGradNFT.connect(university).mintDegree(student.address, STUDENT_ID, URI);
    });

    it("Issuer can revoke (burn) degree", async function () {
      await expect(chainGradNFT.connect(university).revokeDegree(1))
        .to.emit(chainGradNFT, "DegreeRevoked")
        .withArgs(1, university.address);

      await expect(chainGradNFT.ownerOf(1)).to.be.revertedWithCustomError(
        chainGradNFT,
        "ERC721NonexistentToken"
      );
    });

    it("Admin can revoke degree", async function () {
      await expect(chainGradNFT.connect(admin).revokeDegree(1))
        .to.emit(chainGradNFT, "DegreeRevoked")
        .withArgs(1, admin.address);
    });

    it("Stranger cannot revoke degree", async function () {
      await expect(
        chainGradNFT.connect(stranger).revokeDegree(1)
      ).to.be.revertedWithCustomError(chainGradNFT, "NotAuthorized");
    });

    it("Student cannot revoke their own degree", async function () {
      await expect(
        chainGradNFT.connect(student).revokeDegree(1)
      ).to.be.revertedWithCustomError(chainGradNFT, "NotAuthorized");
    });
  });

  describe("ChainGradNFT - Scholarship Claiming", function () {
    beforeEach(async function () {
      await accessManager.connect(admin).authorizeUniversity(university.address);
      await accessManager.connect(admin).authorizeScholarshipBoard(board.address);
      await chainGradNFT.connect(university).mintDegree(student.address, STUDENT_ID, URI);
    });

    it("Board can claim funding", async function () {
      await expect(chainGradNFT.connect(board).claimScholarship(1))
        .to.emit(chainGradNFT, "ScholarshipClaimed")
        .withArgs(1, board.address);

      const record = await chainGradNFT.degreeRecords(1);
      expect(record.isFunded).to.be.true;
    });

    it("Board cannot double-claim", async function () {
      await chainGradNFT.connect(board).claimScholarship(1);
      await expect(
        chainGradNFT.connect(board).claimScholarship(1)
      ).to.be.revertedWithCustomError(chainGradNFT, "AlreadyFunded");
    });

    it("Stranger cannot claim", async function () {
      await expect(
        chainGradNFT.connect(stranger).claimScholarship(1)
      ).to.be.revertedWithCustomError(chainGradNFT, "NotAuthorized");
    });
  });

  describe("ChainGradNFT - Pause", function () {
    beforeEach(async function () {
      await accessManager.connect(admin).authorizeUniversity(university.address);
      await accessManager.connect(admin).authorizeScholarshipBoard(board.address);
      await chainGradNFT.connect(university).mintDegree(student.address, STUDENT_ID, URI);
      await accessManager.connect(admin).pause();
    });

    it("Minting blocked when paused", async function () {
      await expect(
        chainGradNFT.connect(university).mintDegree(student.address, "NEWID", URI)
      ).to.be.revertedWithCustomError(chainGradNFT, "SystemPaused");
    });

    it("Claiming blocked when paused", async function () {
      await expect(
        chainGradNFT.connect(board).claimScholarship(1)
      ).to.be.revertedWithCustomError(chainGradNFT, "SystemPaused");
    });

    it("Revocation blocked when paused", async function () {
      await expect(
        chainGradNFT.connect(university).revokeDegree(1)
      ).to.be.revertedWithCustomError(chainGradNFT, "SystemPaused");
    });

    it("Functions resume after unpause", async function () {
      await accessManager.connect(admin).unpause();
      await expect(chainGradNFT.connect(university).mintDegree(student.address, "NEWID", URI)).to.not.be.reverted;
    });
  });

  describe("ChainGradNFT - Verification & Metadata", function () {
    beforeEach(async function () {
      await accessManager.connect(admin).authorizeUniversity(university.address);
      await chainGradNFT.connect(university).mintDegree(student.address, STUDENT_ID, URI);
    });

    it("verifyDegree returns full record", async function () {
      const record = await chainGradNFT.verifyDegree(1);
      expect(record.owner).to.equal(student.address);
      expect(record.uri).to.equal(URI);
      expect(record.studentId).to.equal(STUDENT_ID);
      expect(record.issuer).to.equal(university.address);
      expect(record.isFunded).to.be.false;
    });

    it("verifyByStudentId returns full record", async function () {
      const record = await chainGradNFT.verifyByStudentId(STUDENT_ID);
      expect(record.owner).to.equal(student.address);
      expect(record.uri).to.equal(URI);
      expect(record.studentId).to.equal(STUDENT_ID);
      expect(record.issuer).to.equal(university.address);
      expect(record.isFunded).to.be.false;
    });
  });
});
