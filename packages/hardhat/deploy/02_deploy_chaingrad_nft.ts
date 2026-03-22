import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys ChainGradNFT, passing the AccessManager address as constructor arg.
 * Depends on AccessManager being deployed first (via tags).
 */
const deployChainGradNFT: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Get the already-deployed AccessManager address
  const accessManager = await hre.deployments.get("AccessManager");

  await deploy("ChainGradNFT", {
    from: deployer,
    args: [accessManager.address],
    log: true,
    autoMine: true,
  });
};

export default deployChainGradNFT;

deployChainGradNFT.tags = ["ChainGradNFT"];
deployChainGradNFT.dependencies = ["AccessManager"];
