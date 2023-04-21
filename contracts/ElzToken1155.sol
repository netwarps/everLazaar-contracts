// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "./IToken1155.sol";

contract ElzToken1155 is IToken1155, ERC1155BurnableUpgradeable, ERC1155SupplyUpgradeable, OwnableUpgradeable {

    function initialize(string memory uri_) public initializer {
        __ERC1155_init(uri_);
        __ERC1155Burnable_init();
        __ERC1155Supply_init();
        __Ownable_init();
    }

    function setURI(string memory newUri) public override onlyOwner {
        _setURI(newUri);
    }

    function mint(address account, uint256 id, uint256 amount, bytes memory data) public override onlyOwner {
        _mint(account, id, amount, data);
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) public override onlyOwner {
        _mintBatch(to, ids, amounts, data);
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) internal override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function exists(uint256 id) public view override(ERC1155SupplyUpgradeable, IToken1155) returns (bool) {
        return super.totalSupply(id) > 0;
    }

    uint256[50] private __gap; // storage gap for upgrading
}
