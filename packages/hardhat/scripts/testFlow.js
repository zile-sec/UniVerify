import { ethers } from "ethers";
import fs from "fs";

const RPC_URL = "http://127.0.0.1:8545";

const ACCESS_MANAGER_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const CHAINGRADNFT_ADDRESS = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";

const accessManagerAbi = JSON.parse(
  fs.readFileSync("./abi/AccessManagerABI.json", "utf8")
);

const chainGradAbi = JSON.parse(
  fs.readFileSync("./abi/ChainGradNFTABI.json", "utf8")
);

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const admin = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );

  const university = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );

  const board = new ethers.Wallet(
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    provider
  );

  const student = new ethers.Wallet(
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    provider
  );

  const accessManagerAdmin = new ethers.Contract(
    ACCESS_MANAGER_ADDRESS,
    accessManagerAbi,
    admin
  );

  const chainGradUniversity = new ethers.Contract(
    CHAINGRADNFT_ADDRESS,
    chainGradAbi,
    university
  );

  const chainGradBoard = new ethers.Contract(
    CHAINGRADNFT_ADDRESS,
    chainGradAbi,
    board
  );

  const chainGradRead = new ethers.Contract(
    CHAINGRADNFT_ADDRESS,
    chainGradAbi,
    provider
  );

  console.log("1. Authorizing university...");
  let tx = await accessManagerAdmin.authorizeUniversity(university.address);
  await tx.wait();
  console.log("University authorized:", university.address);

  console.log("2. Authorizing scholarship board...");
  tx = await accessManagerAdmin.authorizeScholarshipBoard(board.address);
  await tx.wait();
  console.log("Scholarship board authorized:", board.address);

  console.log("3. Minting degree...");
  tx = await chainGradUniversity.mintDegree(
    student.address,
    "STU001",
    "ipfs://example-degree-metadata"
  );
  await tx.wait();
  console.log("Degree minted.");

  const tokenId = 1;

  console.log("4. Verifying degree...");
  const degree = await chainGradRead.verifyDegree(tokenId);
  console.log("verifyDegree:", degree);

  console.log("5. Verifying by student ID...");
  const byStudent = await chainGradRead.verifyByStudentId("STU001");
  console.log("verifyByStudentId:", byStudent);

  console.log("6. Claiming scholarship...");
  tx = await chainGradBoard.claimScholarship(tokenId);
  await tx.wait();
  console.log("Scholarship claimed.");

  console.log("7. Verifying after scholarship...");
  const updated = await chainGradRead.verifyDegree(tokenId);
  console.log("Updated degree:", updated);

  console.log("ALL TESTS COMPLETED");
}

main().catch((err) => {
  console.error("ERROR:");
  console.error(err);
});