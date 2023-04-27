// SPDX-License-Identifier: MIT
// Everlazaar.sol

pragma solidity ^0.8.3;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "./IToken1155.sol";
import "./ElzToken1155.sol";


contract Everlazaar is Initializable, ContextUpgradeable, EIP712Upgradeable, OwnableUpgradeable {

    using Counters for Counters.Counter;

    event ArticleCreated (
        address indexed creator,
        uint64 articleContractId,
        bytes32 articleHash
    );

    event Deposit (
        address sender,
        uint256 amount
    );

    event Withdraw (
        address sender,
        uint256 amount
    );

    event ArticleMinted (
        address owner,
        uint64 tokenId,
        uint256 amount
    );

    struct ArticleEntry {
        address owner; // who created the article
        bytes32 hash;   // the hash of the article, unique
    }

    //    uint256 constant MAX_NUMBER_OF_SHARES = 10**30; // maximum number of shares that can be minted

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private constant _PERMIT_TYPE_HASH_CREATE_ITEM =
        keccak256("PermitCreateArticle(bytes32 hash,address owner,uint256 nonce)");

    bytes32 private constant _PERMIT_TYPE_HASH_MINT =
        keccak256("PermitMint(uint64 articleContractId,uint256 amount,address owner,uint256 nonce)");

    mapping(address => Counters.Counter) private _nonces;

    uint256 private _articleDeposit; // default = 0.01 Token
    uint256 private _mintDeposit; // default = 0.1 Token

    IERC20Upgradeable private _kmc; // approved token contract reference

    IToken1155 private _token1155; // ERC1155 token contract reference

    bool locked; // prevent re-entrancy

    ArticleEntry[] private _articleArray;

    /********
    MODIFIERS
    ********/
    modifier noReentrancy() {
        require(!locked, "Everlazaar: Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function initialize(address kmcAddr_, address token1155Addr_,
        uint256 articleDeposit_, uint256 mintDeposit_) public initializer {

        require(kmcAddr_ != address(0), "Everlazaar::constructor - kmc address cannot be 0");
        require(token1155Addr_ != address(0), "Everlazaar::constructor - token1155 address cannot be 0");

        __Context_init();
        __EIP712_init("Everlazaar", "1");
        __Ownable_init();

        _kmc = IERC20Upgradeable(kmcAddr_);
        _token1155 = IToken1155(token1155Addr_);

        _articleDeposit = articleDeposit_;
        _mintDeposit = mintDeposit_;

        _articleArray.push();
    }

    function kmc() public view returns (address) {
        return address(_kmc);
    }
    function token1155() public view returns (address) {
        return address(_token1155);
    }
    function articleDeposit() public view returns (uint256) {
        return _articleDeposit;
    }
    function mintDeposit() public view returns (uint256) {
        return _mintDeposit;
    }

    function getArticle(uint64 articleContractId) public view returns (ArticleEntry memory) {
        require(articleContractId < _articleArray.length, "Everlazaar::getArticle - invalid articleContractId");

        ArticleEntry memory article = _articleArray[articleContractId];
        return article;
    }
    function getArticleCount() public view returns (uint256) {
        return _articleArray.length;
    }

    function _createArticle(bytes32 hash, address owner) private {

        // collect deposit from sender and store it
        if (_articleDeposit > 0) {
            _kmc.transferFrom(owner, address(this), _articleDeposit);
        }

        ArticleEntry storage article = _articleArray.push();
        article.owner = owner;
        article.hash = hash;

        uint256 articleContractIndex = _articleArray.length - 1;
        emit ArticleCreated(owner, uint64(articleContractIndex), hash);
    }

//    function createArticle(bytes32 hash) public noReentrancy {
//        _createArticle(hash, msg.sender);
//    }

    function permitCreateArticle(
        bytes32 hash,
        address owner,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public noReentrancy {

        bytes memory encode = abi.encode(_PERMIT_TYPE_HASH_CREATE_ITEM, hash, owner, _useNonce(owner));
        address signer = _recoverSigner(encode, v, r, s);
        require(signer == owner, "Everlazaar::permitCreateArticle - invalid signature");

        _createArticle(hash, owner);
    }

    function _mint(uint64 articleContractId, uint256 amount, address operator) private {

        require(articleContractId < _articleArray.length, "Everlazaar::mint - invalid articleContractId");
        require(operator == _articleArray[articleContractId].owner, "Everlazaar::mint - not article owner");
        require(amount > 0, "Everlazaar::mint - invalid amount");
        require(!_token1155.exists(articleContractId), "Everlazaar::mint - token existing");

        // collect deposit from sender and store it
        if (_mintDeposit > 0) {
            _kmc.transferFrom(operator, address(this), _mintDeposit);
        }

        _token1155.mint(operator, articleContractId, amount, new bytes(articleContractId));

        emit ArticleMinted(operator, articleContractId, amount);
    }

//    function mint(uint64 articleContractId, uint256 amount) public noReentrancy {
//       _mint(articleContractId, amount, msg.sender);
//    }

    function permitMint(
        uint64 articleContractId,
        uint256 amount,
        address owner,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public noReentrancy {

        bytes memory encode = abi.encode(_PERMIT_TYPE_HASH_MINT, articleContractId, amount, owner, _useNonce(owner));
        address signer = _recoverSigner(encode, v, r, s);
        require(signer == owner, "Everlazaar::permitMint - invalid signature");

        _mint(articleContractId, amount, owner);
    }

    // transfer native tokens to the contract, get some ERC20 back
    function deposit() public noReentrancy payable {
        require(msg.value >= 1000000000000, "Everlazaar::deposit - deposit too little");

        uint256 amount = msg.value;

        require(
            _kmc.transfer(msg.sender, amount * 1000),
            "Everlazaar: Deposit transfer failed"
        );

        emit Deposit(
            msg.sender,
            amount
        );
    }

    // transfer ERC20 to proportionally withdraw native tokens
    function withdraw(uint256 amount) public noReentrancy {
        // collect token from sender and store it
        require(_kmc.transferFrom(msg.sender, address(this), amount), "Everlazaar::withdraw - withdraw token transfer failed");

        payable(msg.sender).transfer(amount / 1000);

        emit Withdraw(
            msg.sender,
            amount
        );
    }

    //Permit related methods similar with ERC20Permit
    function nonces(address owner) public view returns (uint256) {
        return _nonces[owner].current();
    }

    function _useNonce(address owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }

    function _recoverSigner(
        bytes memory abiEncode,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) private view returns(address) {

        bytes32 structHash = keccak256(abiEncode);

        bytes32 hash = _hashTypedDataV4(structHash);

        return ECDSAUpgradeable.recover(hash, v, r, s);
    }

    function adminWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Everlazaar::adminWithdraw - withdraw amount exceeds balance");
        payable(msg.sender).transfer(amount);
    }

    function setArticleDeposit(uint256 articleDeposit_) public {
        _articleDeposit = articleDeposit_;
    }
    function setMintDeposit(uint256 mintDeposit_) public {
        _mintDeposit = mintDeposit_;
    }

    uint256[50] private __gap; // storage gap for upgrading
}
