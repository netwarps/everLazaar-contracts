// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract KmcToken is ERC20PermitUpgradeable, OwnableUpgradeable {
    string _version;

    //constructor(uint256 supply) ERC20("Kmc Token", "KMC") ERC20Permit("Kmc Token") {
    function initialize(uint256 supply) public initializer {
        string memory name = "Kmc Token";
        string memory symbol = "KMC";
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __Ownable_init();

        _version = "1";
        _mint(msg.sender, supply);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function getInitializedVersion() public view returns (uint8) {
        return _getInitializedVersion();
    }
    function getVersion() public view returns (string memory) {
        return _version;
    }
    function getVersion2() public view returns (string memory) {
        return _version;
    }
    function reinitialize(string calldata _ver, uint8 i) public reinitializer(i) {
        doUpgradeStuff(_ver);
    }
    function doUpgradeStuff(string calldata _ver) internal onlyInitializing {
        //doing upgrade work here ...
        _version = _ver;

    }

    uint256[50] private __gap;
}
