const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with the account:', deployer.address);

  const devWallet = deployer.address; // For test we use deployer as dev wallet

  const TokenContract = await hre.ethers.getContractFactory('SnakeLadderTokens');
  const contract = await TokenContract.deploy(devWallet);
  await contract.deployed();

  console.log('SnakeLadderTokens deployed to:', contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
