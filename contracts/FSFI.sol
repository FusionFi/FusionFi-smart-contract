// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
import "./IFSFI.sol";

/// @title FSFI contract
/// @author
/// @notice Link/usd
contract FSFI is IFSFI, Initializable {
    using Clones for address;
    mapping(address => bool) public operators;
    uint public loandIds;
    address public owner;
    bool public isPaused;
    mapping(address => uint[]) public userLoans;
    IFSFIConfig public fsfiConfig;
    IFSFILoan public fsfiLoan;
    mapping(IERC20Standard => IFSFIPool) public fsfiPools;
    mapping(uint => IFSFILoan) loans;

    modifier onlyOwner() {
        require(msg.sender == owner, Errors.ONLY_THE_OWNER);
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender] == true, Errors.ONLY_THE_OPERATOR);
        _;
    }

    modifier supportedPoolToken(IERC20Standard _tokenAddress) {
        require(
            fsfiConfig.getFsfiActiveCoins(_tokenAddress) == true,
            Errors.POOL_TOKEN_IS_NOT_ACTIVED
        );
        _;
    }

    modifier supportedCollateralToken(IERC20Standard _tokenAddress) {
        require(
            fsfiConfig.getFsfiActiveCoins(_tokenAddress) == true,
            Errors.COLLATERAL_TOKEN_IS_NOT_ACTIVED
        );
        _;
    }

    modifier onlyETHNative() {
        require(
            fsfiConfig.getEnableETHNative() == true,
            Errors.ETH_NATIVE_DISABLE
        );
        _;
    }

    modifier onlyUnpaused() {
        require(isPaused == false, Errors.SC_IS_PAUSED);
        _;
    }

    function checkExistElement(
        IERC20Standard[] memory array,
        IERC20Standard el
    ) public pure returns (bool) {
        bool isExist = false;
        // check _tokenAddress is valid
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == el) {
                isExist = true;
                break;
            }
        }
        return isExist;
    }

    function initialize(
        IERC20Standard[] memory _fsfiPoolStableCoin,
        IFSFIPool[] memory _fsfiPools,
        IFSFIConfig _fsfiConfig,
        IFSFILoan _fsfiLoan
    ) external initializer {
        for (uint i = 0; i < _fsfiPools.length; i++) {
            fsfiPools[_fsfiPoolStableCoin[i]] = _fsfiPools[i];
        }
        loandIds = 1;
        owner = msg.sender;
        operators[msg.sender] = true;
        fsfiConfig = _fsfiConfig;
        fsfiLoan = _fsfiLoan;
    }

    function setPools(
        IERC20Standard[] memory _fsfiPoolStableCoin,
        IFSFIPool[] memory _fsfiPools
    ) public onlyOperator {
        for (uint i = 0; i < _fsfiPools.length; i++) {
            fsfiPools[_fsfiPoolStableCoin[i]] = _fsfiPools[i];
        }
    }

    function setFSFILoan(IFSFILoan _loan) public onlyOwner {
        fsfiLoan = _loan;
    }

    function setPaused(bool _paused) public onlyOwner {
        isPaused = _paused;
    }

    function setOperators(
        address[] memory _addresses,
        bool[] memory _isActives
    ) public onlyOwner {
        for (uint i = 0; i < _addresses.length; i++) {
            operators[_addresses[i]] = _isActives[i];
        }
    }

    // Modifier to check token allowance
    // modifier checkTokenAllowance(IERC20Standard _token, uint _amount) {
    //     require(
    //         _token.allowance(msg.sender, address(this)) >= _amount,
    //         "Error"
    //     );
    //     _;
    // }

    function checkMinimalCollateralForLoan(
        uint _amount,
        IERC20Standard _stableCoin,
        IERC20Standard _collateral
    ) public view returns (uint) {
        (uint maxLTV, uint liquidationThreshold) = fsfiConfig.getThreshold();
        return ((((_amount * (10 ** _collateral.decimals()) * 10000) *
            fsfiConfig.getLatestPrice(_stableCoin, true)) /
            (10 ** _stableCoin.decimals())) /
            maxLTV /
            fsfiConfig.getLatestPrice(_collateral, false));
    }

    // create loan by ERC20
    function createLoan(
        uint _amount,
        IERC20Standard _stableCoin,
        uint _amountCollateral,
        IERC20Standard _collateral,
        bool _isYieldGenerating,
        bool _isFiat
    )
        public
        supportedPoolToken(_stableCoin)
        supportedCollateralToken(_collateral)
        onlyUnpaused
    {
        (uint maxLTV, uint liquidationThreshold) = fsfiConfig.getThreshold();
        require(
            (_amountCollateral *
                fsfiConfig.getLatestPrice(_collateral, false) *
                maxLTV) /
                (10 ** _collateral.decimals()) >=
                ((_amount * fsfiConfig.getLatestPrice(_stableCoin, true)) *
                    10000) /
                    (10 ** _stableCoin.decimals()),
            Errors.DO_NOT_HAVE_ENOUGH_COLLATERAL
        );
        createLoanCore(
            _amount,
            _stableCoin,
            _amountCollateral,
            _collateral,
            _isYieldGenerating,
            _isFiat,
            false
        );
    }

    function estimateHealthFactor(
        IERC20Standard _stableCoin,
        uint _amount,
        IERC20Standard _collateralToken,
        uint _amountCollateral
    ) public view returns (uint) {
        uint stableCoinPrice = fsfiConfig.getLatestPrice(_stableCoin, true);
        uint collateralPrice = fsfiConfig.getLatestPrice(
            _collateralToken,
            false
        );
        (uint maxLTV, uint liquidationThreshold) = fsfiConfig.getThreshold();
        uint totalCollaterals = (_amountCollateral *
            collateralPrice *
            liquidationThreshold) /
            10000 /
            (10 ** _collateralToken.decimals());

        uint totalLoan = (_amount * stableCoinPrice) /
            (10 ** _stableCoin.decimals());

        uint healthFactor = (totalCollaterals * 100) / totalLoan;
        return healthFactor;
    }

    function createLoanCore(
        uint _amount,
        IERC20Standard _stableCoin,
        uint _amountCollateral,
        IERC20Standard _collateral,
        bool _isYieldGenerating,
        bool _isFiat,
        bool _isETH
    ) internal {
        // check pool reseve
        require(
            fsfiPools[_stableCoin].getRemainingPool() >= _amount,
            Errors.DO_NOT_HAVE_ENOUGH_LENDING_FUND
        );

        // make loan ins
        DataTypes.Loan memory loan;
        loan.borrower = msg.sender;
        loan.amount = _amount;
        loan.loanId = loandIds;
        loan.stableCoin = _stableCoin;
        loan.isFiat = _isFiat;

        IERC20Standard token = _collateral;
        // clone a loan SC
        address loanIns = address(fsfiLoan).clone();
        IFSFILoan cloneSC = IFSFILoan(loanIns);
        {
            (uint maxLTV, uint liquidationThreshold) = fsfiConfig
                .getThreshold();
            cloneSC.initialize(loan, token, fsfiConfig);
        }
        cloneSC.setFSFI(address(this));

        {
            uint24 fee = fsfiConfig.getCollateralToStableFee(
                token,
                _stableCoin
            );
            cloneSC.setUniFee(fee);
        }

        if (_isETH == false) {
            // transfer collateral
            _collateral.transferFrom(
                msg.sender,
                address(this),
                _amountCollateral
            );

            _collateral.approve(address(loanIns), _amountCollateral);

            cloneSC.updateCollateral(_amountCollateral);
        } else {
            // transfer collateral
            // get from user to loan
            IWETH wETH = fsfiConfig.getWETH();
            IERC20Standard(address(wETH)).approve(
                address(loanIns),
                _amountCollateral
            );

            cloneSC.updateCollateral(_amountCollateral);
        }

        if (_isYieldGenerating == true) cloneSC.supplyLiquidity();
        loans[loandIds] = cloneSC;
        userLoans[msg.sender].push(loandIds);

        // borrow loan on pool
        fsfiPools[_stableCoin].borrow(
            loan.loanId,
            loan.amount,
            loan.borrower,
            loan.isFiat
        );

        emit CreateLoan(
            msg.sender,
            address(loans[loandIds]),
            loan,
            _amountCollateral,
            _collateral,
            _isYieldGenerating,
            !_isETH
        );

        loandIds++;
    }

    // create loan by ETH
    function createLoanByETH(
        uint _amount,
        IERC20Standard _stableCoin,
        uint _amountETH,
        bool _isYieldGenerating,
        bool _isFiat
    )
        public
        payable
        supportedPoolToken(_stableCoin)
        onlyETHNative
        onlyUnpaused
    {
        require(
            _amountETH <= msg.value,
            Errors.DO_NOT_HAVE_ENOUGH_DEPOSITED_ETH
        );
        IWETH wETH = fsfiConfig.getWETH();
        wETH.deposit{value: _amountETH}();
        (uint maxLTV, uint liquidationThreshold) = fsfiConfig.getThreshold();
        require(
            (_amountETH *
                fsfiConfig.getLatestPrice(
                    IERC20Standard(address(wETH)),
                    false
                ) *
                maxLTV) /
                (10 ** IERC20Standard(address(wETH)).decimals()) >=
                ((_amount * fsfiConfig.getLatestPrice(_stableCoin, true)) *
                    10000) /
                    (10 ** _stableCoin.decimals()),
            Errors.DO_NOT_HAVE_ENOUGH_COLLATERAL
        );

        createLoanCore(
            _amount,
            _stableCoin,
            _amountETH,
            IERC20Standard(address(wETH)),
            _isYieldGenerating,
            _isFiat,
            true
        );
    }

    function addCollateral(
        uint _loanId,
        uint _amountCollateral,
        IERC20Standard _collateral
    ) public supportedCollateralToken(_collateral) onlyUnpaused {
        IFSFILoan loan = loans[_loanId];

        DataTypes.Loan memory info = loan.getLoanInfo();

        // get from user to loan
        _collateral.transferFrom(msg.sender, address(this), _amountCollateral);

        // transfer collateral
        _collateral.approve(address(loan), _amountCollateral);
        loan.updateCollateral(_amountCollateral);

        if (loan.getIsYeild() == true) {
            loan.supplyLiquidity();
        }

        emit AddCollateral(
            msg.sender,
            info,
            _amountCollateral,
            _collateral,
            false
        );
    }

    function addCollateralByETH(
        uint _loanId,
        uint _amountETH
    ) public payable onlyETHNative onlyUnpaused {
        require(
            _amountETH <= msg.value,
            Errors.DO_NOT_HAVE_ENOUGH_DEPOSITED_ETH
        );
        IWETH wETH = fsfiConfig.getWETH();
        wETH.deposit{value: _amountETH}();

        IFSFILoan loan = loans[_loanId];

        DataTypes.Loan memory info = loan.getLoanInfo();

        // transfer collateral
        IERC20Standard(address(wETH)).approve(address(loan), _amountETH);
        loan.updateCollateral(_amountETH);

        if (loan.getIsYeild() == true) {
            loan.supplyLiquidity();
        }

        emit AddCollateral(
            msg.sender,
            info,
            _amountETH,
            IERC20Standard(address(wETH)),
            true
        );
    }

    // repay loan
    function repayLoan(
        uint _loanId,
        uint _amount,
        IERC20Standard _stableCoin
    ) public supportedPoolToken(_stableCoin) onlyUnpaused {
        uint256 payAmount = _amount;
        if (_amount > fsfiPools[_stableCoin].getCurrentLoan(_loanId)) {
            payAmount = fsfiPools[_stableCoin].getCurrentLoan(_loanId);
        }

        IFSFILoan loan = loans[_loanId];
        DataTypes.Loan memory info = loan.getLoanInfo();
        // get back loan
        _stableCoin.transferFrom(msg.sender, address(this), payAmount);
        // repay for pool
        _stableCoin.approve(address(fsfiPools[_stableCoin]), payAmount);
        fsfiPools[_stableCoin].repay(_loanId, payAmount);
        // update collateral balance and get back collateral
        // Todo: if full payment, close loan
        uint _debtRemain = fsfiPools[_stableCoin].getCurrentLoan(_loanId);
        if (_debtRemain == 0) {
            (uint256 usdLender, uint256 usdPlatform) = loans[_loanId]
                .closeLoan();
            if (usdLender > 0) {
                _stableCoin.transferFrom(
                    address(loans[_loanId]),
                    address(fsfiPools[_stableCoin]),
                    usdLender
                );
                fsfiPools[_stableCoin].earnStaking(usdLender);
            }
            (address liquidator, address platform) = fsfiConfig
                .getPlatformAddress();
            if (usdPlatform > 0)
                _stableCoin.transferFrom(
                    address(loans[_loanId]),
                    platform,
                    usdPlatform
                );
        }

        emit RepayLoan(msg.sender, info, _amount, _debtRemain);
    }

    function withdrawAllCollateral(
        uint _loanId,
        bool _isETH
    ) public onlyUnpaused {
        IFSFILoan loan = loans[_loanId];
        DataTypes.Loan memory info = loan.getLoanInfo();
        require(msg.sender == info.borrower, Errors.ONLY_THE_BORROWER);
        loan.withdrawAllCollateral(info.borrower, _isETH);

        emit WithdrawAllCollateral(
            msg.sender,
            info,
            loan.getCollateralAmount(),
            loan.getCollateralToken(),
            _isETH
        );
    }

    function withdrawAllCollateralByAdmin(
        uint _loanId,
        bool isETH
    ) public onlyOwner {
        IFSFILoan loan = loans[_loanId];
        loan.withdrawAllCollateral(msg.sender, isETH);
    }

    function getHealthFactor(uint _loanId) public view returns (uint) {
        IFSFILoan loan = loans[_loanId];
        DataTypes.Loan memory loanInfo = loan.getLoanInfo();
        uint curentDebt = fsfiPools[loanInfo.stableCoin].getCurrentLoan(
            _loanId
        );
        return loan.getHealthFactor(curentDebt, 0);
    }

    function repayHealthFactor(
        uint _loanId,
        uint _amount
    ) public view returns (uint) {
        IFSFILoan loan = loans[_loanId];
        DataTypes.Loan memory loanInfo = loan.getLoanInfo();
        uint curentDebt = fsfiPools[loanInfo.stableCoin].getCurrentLoan(
            _loanId
        );
        if (_amount >= curentDebt) {
            return 99999;
        }
        return loan.getHealthFactor(curentDebt - _amount, 0);
    }

    function addCollateralHealthFactor(
        uint _loanId,
        uint _amountCollateral
    ) public view returns (uint) {
        IFSFILoan loan = loans[_loanId];
        DataTypes.Loan memory loanInfo = loan.getLoanInfo();
        uint curentDebt = fsfiPools[loanInfo.stableCoin].getCurrentLoan(
            _loanId
        );
        return loan.getHealthFactor(curentDebt, _amountCollateral);
    }

    function getLoanAddress(uint _loanId) public view returns (address) {
        IFSFILoan loan = loans[_loanId];
        return address(loan);
    }

    function liquidate(uint _loanId) public onlyUnpaused {
        IFSFILoan loan = loans[_loanId];
        DataTypes.Loan memory loanInfo = loan.getLoanInfo();
        uint curentDebt = fsfiPools[loanInfo.stableCoin].getCurrentLoan(
            _loanId
        );
        (
            uint256 usdLiquidatedLender,
            uint256 usdEarnLender,
            uint256 usdPlatform,
            uint256 usdLiquidator
        ) = loan.liquidate(curentDebt);
        // get back loan
        loanInfo.stableCoin.transferFrom(
            address(loan),
            address(this),
            curentDebt + usdLiquidatedLender + usdEarnLender
        );
        // repay for pool
        loanInfo.stableCoin.approve(
            address(fsfiPools[loanInfo.stableCoin]),
            curentDebt
        );
        fsfiPools[loanInfo.stableCoin].repay(_loanId, curentDebt);
        // update collateral balance and get back collateral

        (address liquidator, address platform) = fsfiConfig
            .getPlatformAddress();

        loanInfo.stableCoin.transferFrom(address(loan), platform, usdPlatform);

        loanInfo.stableCoin.transferFrom(
            address(loan),
            liquidator,
            usdLiquidator
        );

        loanInfo.stableCoin.approve(
            address(fsfiPools[loanInfo.stableCoin]),
            usdLiquidatedLender + usdEarnLender
        );

        fsfiPools[loanInfo.stableCoin].liquidatePenalty(
            _loanId,
            usdLiquidatedLender
        );

        if (usdEarnLender > 0)
            fsfiPools[loanInfo.stableCoin].earnStaking(usdEarnLender);

        emit Liquidate(
            msg.sender,
            loanInfo.borrower,
            loanInfo,
            loan.getCollateralAmount(),
            loan.getCollateralToken()
        );
    }

    function getLoanIds(address borrower) public view returns (uint[] memory) {
        return userLoans[borrower];
    }

    receive() external payable {}
}
