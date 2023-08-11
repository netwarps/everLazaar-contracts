// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "./IToken1155.sol";

contract ElzToken1155 is IToken1155, ERC1155BurnableUpgradeable, ERC1155SupplyUpgradeable, OwnableUpgradeable {
    using StringsUpgradeable for uint256;

    string _version;

    function initialize(string memory uri_) public initializer {
        __ERC1155_init(uri_);
        __ERC1155Burnable_init();
        __ERC1155Supply_init();
        __Ownable_init();
        _version = "1";
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

    function uri(uint256 tokenId_) public view virtual override(IERC1155MetadataURIUpgradeable,ERC1155Upgradeable) returns (string memory) {
        //e.g. https://token-cdn-domain/1234
        //require(_exists(tokenId_), "ElzToken1155#uri: NONEXISTENT_TOKEN");
        string memory baseURI = super.uri(tokenId_);
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId_.toString())) : "";
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) internal override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function exists(uint256 id) public view override(ERC1155SupplyUpgradeable, IToken1155) returns (bool) {
        return super.totalSupply(id) > 0;
    }


    function transferOwnership(address newOwner) public override(IToken1155, OwnableUpgradeable)  onlyOwner {
        super.transferOwnership(newOwner);
    }

    function getInitializedVersion() public view returns (uint8) {
        return _getInitializedVersion();
    }
    function getVersion() public view returns (string memory) {
        return _version;
    }
    function reinitialize(string calldata _ver, uint8 i) public reinitializer(i) {
        doUpgradeStuff(_ver);
    }
    function doUpgradeStuff(string calldata _ver) internal onlyInitializing {
        //doing upgrade work here ...
        _version = _ver;

    }

    uint256[50] private __gap; // storage gap for upgrading
}
