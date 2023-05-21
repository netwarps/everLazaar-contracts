// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";

interface IToken1155 is IERC1155Upgradeable, IERC1155MetadataURIUpgradeable {

  function setURI(string memory newUri) external;

  function exists(uint256 id) external view returns (bool);

  function mint(address account, uint256 id, uint256 amount, bytes memory data) external;

  function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external;

  function transferOwnership(address newOwner) external;

}
