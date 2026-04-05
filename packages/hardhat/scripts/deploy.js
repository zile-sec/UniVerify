import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();

  console.log("Deploying AccessManager...");
  const accessManager = await viem.deployContract("AccessManager", []);
  console.log("AccessManager deployed to:", accessManager.address);

  console.log("Deploying ChainGradNFT...");
  const chainGradNFT = await viem.deployContract("ChainGradNFT", [
    accessManager.address,
  ]);
  console.log("ChainGradNFT deployed to:", chainGradNFT.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});