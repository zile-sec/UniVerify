// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AccessManager
 * @dev Governance hub for ChainGrad / ZAQA. The deployer is the ZAQA_ADMIN
 *      (DEFAULT_ADMIN_ROLE) and may grant/revoke both UNIVERSITY_ROLE and
 *      SCHOLARSHIP_BOARD_ROLE.  A global pause flag lets ZAQA halt operations
 *      during emergencies.
 */
contract AccessManager is AccessControl, Pausable {
    bytes32 public constant UNIVERSITY_ROLE = keccak256("UNIVERSITY_ROLE");
    bytes32 public constant SCHOLARSHIP_BOARD_ROLE = keccak256("SCHOLARSHIP_BOARD_ROLE");

    /// @dev Deployer becomes ZAQA admin.
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ──────────────── role administration ────────────────

    /// @dev Authorize a university to mint degrees.
    function authorizeUniversity(address _uni) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(UNIVERSITY_ROLE, _uni);
    }

    /// @dev Revoke a previously authorized university.
    function revokeUniversity(address _uni) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(UNIVERSITY_ROLE, _uni);
    }

    /// @dev Authorize a scholarship board to claim funding.
    function authorizeScholarshipBoard(address _board) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(SCHOLARSHIP_BOARD_ROLE, _board);
    }

    /// @dev Revoke a board's authorization.
    function revokeScholarshipBoard(address _board) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(SCHOLARSHIP_BOARD_ROLE, _board);
    }

    /// @dev Helper to query admin membership.
    function isAdmin(address account) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    // ──────────────── emergency pause ────────────────

    /// @dev Pause all operations that are guarded by `whenNotPaused`.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @dev Unpause after emergency.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
