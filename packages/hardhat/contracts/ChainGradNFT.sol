// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./AccessManager.sol";

/**
 * @title ChainGradNFT
 * @dev Soulbound ERC-721 Degree Token for the ZAQA verification system.
 *
 *      KEY PROPERTIES:
 *      • Non-transferable (Soulbound) — only minting and burning allowed.
 *      • University-prefixed studentId stored on-chain (e.g. "ZC2020100525").
 *      • Auto-incrementing uint256 tokenId for ERC-721 compliance.
 *      • Reverse lookup: studentId → tokenId for human-friendly search.
 *      • Scholarship funding flag to prevent double-funding.
 */
contract ChainGradNFT is ERC721, ERC721URIStorage {
    // ──────────────── State ────────────────

    AccessManager public accessManager;
    uint256 private _nextTokenId;

    struct DegreeRecord {
        string  studentId;   // university-prefixed ID, e.g. "ZC2020100525"
        address issuer;      // university wallet that minted
        uint256 timestamp;   // block.timestamp at mint
        bool    isFunded;    // scholarship claimed?
    }

    mapping(uint256 => DegreeRecord) public degreeRecords;
    mapping(string  => uint256)      public studentIdToTokenId;

    // ──────────────── Events ────────────────

    event DegreeMinted(
        uint256 indexed tokenId,
        address indexed student,
        address indexed issuer,
        string studentId
    );
    event DegreeRevoked(uint256 indexed tokenId, address indexed revokedBy);
    event ScholarshipClaimed(uint256 indexed tokenId, address indexed board);

    // ──────────────── Errors ────────────────

    error Soulbound();                    // transfers are disabled
    error StudentIdAlreadyUsed(string studentId);
    error NotAuthorized();
    error DegreeNotValid();
    error AlreadyFunded();
    error SystemPaused();

    // ──────────────── Constructor ────────────────

    constructor(address _accessManager)
        ERC721("ChainGrad Degree", "CGRAD")
    {
        require(_accessManager != address(0), "zero manager");
        accessManager = AccessManager(_accessManager);
    }

    // ──────────────── Modifiers ────────────────

    modifier onlyUniversity() {
        if (!accessManager.hasRole(accessManager.UNIVERSITY_ROLE(), msg.sender))
            revert NotAuthorized();
        _;
    }

    modifier onlyBoard() {
        if (!accessManager.hasRole(accessManager.SCHOLARSHIP_BOARD_ROLE(), msg.sender))
            revert NotAuthorized();
        _;
    }

    modifier whenNotPaused() {
        if (accessManager.paused()) revert SystemPaused();
        _;
    }

    // ──────────────── Core: Mint ────────────────

    /**
     * @dev University mints a Soulbound degree NFT to a student.
     * @param student     The student's wallet address (token recipient).
     * @param studentId   University-prefixed ID, e.g. "ZC2020100525".
     * @param uri         IPFS URI pointing to the degree metadata JSON.
     * @return tokenId    The auto-generated ERC-721 token ID.
     */
    function mintDegree(
        address student,
        string calldata studentId,
        string calldata uri
    )
        external
        onlyUniversity
        whenNotPaused
        returns (uint256)
    {
        // Guard: no duplicate student IDs
        if (studentIdToTokenId[studentId] != 0)
            revert StudentIdAlreadyUsed(studentId);

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        _safeMint(student, tokenId);
        _setTokenURI(tokenId, uri);

        degreeRecords[tokenId] = DegreeRecord({
            studentId: studentId,
            issuer:    msg.sender,
            timestamp: block.timestamp,
            isFunded:  false
        });

        studentIdToTokenId[studentId] = tokenId;

        emit DegreeMinted(tokenId, student, msg.sender, studentId);
        return tokenId;
    }

    // ──────────────── Soulbound: Block Transfers ────────────────

    /**
     * @dev Override the internal _update hook to block all transfers.
     *      Only minting (from == address(0)) and burning (to == address(0))
     *      are allowed.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from = 0) and burning (to = 0)
        if (from != address(0) && to != address(0)) {
            revert Soulbound();
        }

        return super._update(to, tokenId, auth);
    }

    // ──────────────── Core: Revoke (Burn) ────────────────

    /**
     * @dev Revoke a degree by burning the token.
     *      Can be called by the issuing university OR the ZAQA admin.
     *      Used when a qualification is revoked (e.g. plagiarism).
     */
    function revokeDegree(uint256 tokenId) external whenNotPaused {
        DegreeRecord storage rec = degreeRecords[tokenId];

        // Ensure the token exists (issuer is set during mint)
        if (rec.issuer == address(0)) revert DegreeNotValid();

        bool callerIsAdmin = accessManager.hasRole(
            accessManager.DEFAULT_ADMIN_ROLE(),
            msg.sender
        );
        bool callerIsIssuer = (rec.issuer == msg.sender &&
            accessManager.hasRole(accessManager.UNIVERSITY_ROLE(), msg.sender));

        if (!callerIsAdmin && !callerIsIssuer) revert NotAuthorized();

        // Burn the Soulbound token
        _burn(tokenId);

        emit DegreeRevoked(tokenId, msg.sender);
    }

    // ──────────────── Core: Scholarship Claim ────────────────

    /**
     * @dev Scholarship board marks a degree as funded.
     *      Prevents double-funding via the `isFunded` flag.
     */
    function claimScholarship(uint256 tokenId)
        external
        onlyBoard
        whenNotPaused
    {
        // ownerOf will revert if token was burned/doesn't exist
        _requireOwned(tokenId);

        DegreeRecord storage rec = degreeRecords[tokenId];
        if (rec.isFunded) revert AlreadyFunded();

        rec.isFunded = true;
        emit ScholarshipClaimed(tokenId, msg.sender);
    }

    // ──────────────── View: Verify ────────────────

    /**
     * @dev Public function to verify a degree by tokenId.
     */
    function verifyDegree(uint256 tokenId)
        external
        view
        returns (
            address owner,
            string memory uri,
            string memory studentId,
            address issuer,
            uint256 timestamp,
            bool    isFunded
        )
    {
        // Will return address(0) if token was burned
        owner = _ownerOf(tokenId);
        uri = tokenURI(tokenId);

        DegreeRecord storage rec = degreeRecords[tokenId];
        studentId = rec.studentId;
        issuer    = rec.issuer;
        timestamp = rec.timestamp;
        isFunded  = rec.isFunded;
    }

    /**
     * @dev Public function to verify a degree by the university-prefixed studentId.
     */
    function verifyByStudentId(string calldata _studentId)
        external
        view
        returns (
            address owner,
            string memory uri,
            string memory studentId,
            address issuer,
            uint256 timestamp,
            bool    isFunded
        )
    {
        uint256 tokenId = studentIdToTokenId[_studentId];
        require(tokenId != 0, "Student ID not found");

        owner = _ownerOf(tokenId);
        uri = tokenURI(tokenId);

        DegreeRecord storage rec = degreeRecords[tokenId];
        studentId = rec.studentId;
        issuer    = rec.issuer;
        timestamp = rec.timestamp;
        isFunded  = rec.isFunded;
    }

    // ──────────────── Required Overrides ────────────────

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
