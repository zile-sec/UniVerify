"use client";

import { useState } from "react";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { parseAbi } from "viem";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { useReadContract, useWriteContract } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

// IMPORTANT: Replace with your deployed contract address
const contractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const abi = parseAbi([
  "function mintDegree(address student, string studentId, string uri)",
  "function verifyDegree(uint256 tokenId) view returns (address owner, string uri, string studentId, address issuer, uint256 timestamp, bool isFunded)",
]);

const Home: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { writeContractAsync } = useWriteContract();

  const [studentWallet, setStudentWallet] = useState("");
  const [studentId, setStudentId] = useState("");
  const [uri, setUri] = useState("");

  const [tokenId, setTokenId] = useState("");
  const [verifyToken, setVerifyToken] = useState<bigint | undefined>();

  const [status, setStatus] = useState("");

  // 🔍 Read contract
  const { data: verifyData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName: "verifyDegree",
    args: verifyToken !== undefined ? [verifyToken] : undefined,
    query: { enabled: verifyToken !== undefined },
  });

  // 📝 Write contract
  const handleMint = async () => {
    try {
      setStatus("Waiting for wallet confirmation...");

      const tx = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi,
        functionName: "mintDegree",
        args: [studentWallet as `0x${string}`, studentId, uri],
      });

      setStatus(`Transaction sent: ${tx}`);
    } catch (error) {
      setStatus("Transaction failed or rejected.");
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col items-center p-10 space-y-10">
      {/* 🔗 Wallet Section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">UniVerify DApp</h1>
        <p className="font-medium">Connected Address:</p>
        <Address
          address={connectedAddress}
          chain={targetNetwork}
          blockExplorerAddressLink={
            targetNetwork.id === hardhat.id ? `/blockexplorer/address/${connectedAddress}` : undefined
          }
        />
        <p className="mt-2">Status: {isConnected ? "Connected" : "Not Connected"}</p>
      </div>

      {/* 📝 Mint Degree */}
      <div className="border p-6 rounded-xl w-full max-w-md space-y-3">
        <h2 className="text-xl font-bold">Register Degree</h2>

        <input
          className="border p-2 w-full"
          placeholder="Student Wallet Address"
          value={studentWallet}
          onChange={e => setStudentWallet(e.target.value)}
        />

        <input
          className="border p-2 w-full"
          placeholder="Student ID"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
        />

        <input
          className="border p-2 w-full"
          placeholder="Metadata URI"
          value={uri}
          onChange={e => setUri(e.target.value)}
        />

        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={handleMint} disabled={!isConnected}>
          Submit Transaction
        </button>
      </div>

      {/* 🔍 Verify Degree */}
      <div className="border p-6 rounded-xl w-full max-w-md space-y-3">
        <h2 className="text-xl font-bold">Verify Degree</h2>

        <input
          className="border p-2 w-full"
          placeholder="Enter Token ID"
          value={tokenId}
          onChange={e => setTokenId(e.target.value)}
        />

        <button
          className="bg-green-500 text-white px-4 py-2 rounded"
          onClick={() => {
            try {
              if (tokenId.trim() === "") {
                setStatus("Please enter a token ID");
                return;
              }
              setVerifyToken(BigInt(tokenId));
              setStatus("Verifying...");
            } catch {
              setStatus("Invalid token ID");
            }
          }}
        >
          Verify
        </button>

        {verifyData && (
          <div className="mt-4 text-sm space-y-1">
            <p>
              <strong>Owner:</strong> {verifyData[0]}
            </p>
            <p>
              <strong>URI:</strong> {verifyData[1]}
            </p>
            <p>
              <strong>Student ID:</strong> {verifyData[2]}
            </p>
            <p>
              <strong>Issuer:</strong> {verifyData[3]}
            </p>
            <p>
              <strong>Timestamp:</strong> {verifyData[4].toString()}
            </p>
            <p>
              <strong>Funded:</strong> {verifyData[5] ? "Yes" : "No"}
            </p>
          </div>
        )}
      </div>

      {/* 📊 Status */}
      <div className="border p-4 rounded-xl w-full max-w-md text-center">
        <h2 className="font-bold">Transaction Status</h2>
        <p>{status || "No transaction yet."}</p>
      </div>
    </div>
  );
};

export default Home;
