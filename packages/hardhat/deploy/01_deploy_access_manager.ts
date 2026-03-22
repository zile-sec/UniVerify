import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys the AccessManager contract.
 * The deployer automatically becomes the ZAQA admin (DEFAULT_ADMIN_ROLE).
 */
const deployAccessManager: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("AccessManager", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

export default deployAccessManager;

deployAccessManager.tags = ["AccessManager"];
