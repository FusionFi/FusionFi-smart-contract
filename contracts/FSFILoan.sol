// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
import "./IFSFILoan.sol";

/// @title FSFI loan contract
/// @author
/// @notice Link/usd
contract FSFILoan is IFSFILoan, Initializable {
    address public owner;

    // aave config
    bool public isStakeAave;

    // uniswap config
    uint24 public feeTier = 3000;

    // collateral
    uint public collateralAmount;
    IERC20Standard public collateralToken;

    // default loan
    DataTypes.Loan public initLoan;

    // fsfi sc
    address public fsfi;
    address public platform;

    uint public sharePlatform;
    uint public shareLender;
    uint public shareBorrower;

    IFSFIConfig public iFSFIConfig;

    modifier onlyOwner() {
        require(msg.sender == owner, Errors.ONLY_THE_OWNER);
        _;
    }

    constructor() {}

    function setFSFI(address _fsfi) public onlyOwner {
        fsfi = _fsfi;
    }

    function setUniFee(uint24 _uniFee) public onlyOwner {
        if (_uniFee > 0) feeTier = _uniFee;
    }

    function initialize(
        DataTypes.Loan memory _loan,
        IERC20Standard _collateralToken,
        IFSFIConfig _iFSFIConfig
    ) external initializer {
        owner = msg.sender;
        iFSFIConfig = _iFSFIConfig;
        initLoan = _loan;
        collateralToken = _collateralToken;
    }

    function supplyLiquidity() public onlyOwner {
        IERC20Standard asset = collateralToken;
        uint amount = asset.balanceOf(address(this));
        require(amount > 0, Errors.DO_NOT_HAVE_ASSETS);
        address onBehalfOf = address(this);
        uint16 referralCode = 0;
        IPoolAddressesProvider aaveAddressProvider = iFSFIConfig
            .getAaveProvider();
        IPool aavePool = IPool(aaveAddressProvider.getPool());
        asset.approve(address(aavePool), amount);
        aavePool.supply(address(asset), amount, onBehalfOf, referralCode);
        emit LiquiditySupplied(onBehalfOf, address(asset), amount);
        isStakeAave = true;
    }

    function withdrawLiquidity(
        uint _earnPlatform,
        uint _earnBorrower,
        uint _earnLender
    ) public onlyOwner {
        IERC20Standard asset = collateralToken;
        IERC20Standard aToken = iFSFIConfig.getAtoken(asset);
        uint amount = aToken.balanceOf(address(this));
        require(amount > 0, Errors.DO_NOT_HAVE_ASSETS);
        IPoolAddressesProvider aaveAddressProvider = iFSFIConfig
            .getAaveProvider();
        IPool aavePool = IPool(aaveAddressProvider.getPool());
        aavePool.withdraw(address(asset), amount, address(this));
        emit LiquidityWithdrawn(address(this), address(asset), amount);

        isStakeAave = false;
        // share 30% for platform;
        uint currentCollateral = collateralToken.balanceOf(address(this));
        if (currentCollateral - collateralAmount > 0) {
            shareBorrower =
                ((currentCollateral - collateralAmount) * (_earnBorrower)) /
                10000;

            sharePlatform =
                (((currentCollateral - collateralAmount) - shareBorrower) *
                    (_earnPlatform)) /
                (_earnLender + _earnPlatform);

            shareLender =
                (currentCollateral - collateralAmount) -
                shareBorrower -
                sharePlatform;
        }
    }

    function getUserAccountData(
        address user
    )
        public
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        IPoolAddressesProvider aaveAddressProvider = iFSFIConfig
            .getAaveProvider();
        IPool aavePool = IPool(aaveAddressProvider.getPool());
        return aavePool.getUserAccountData(user);
    }

    // 5. Liquidation
    // Good > 100, bad < 100
    function getHealthFactor(
        uint currentDebt,
        uint addCollateral
    ) public view returns (uint) {
        uint stableCoinPrice = iFSFIConfig.getLatestPrice(
            initLoan.stableCoin,
            true
        );
        uint totalCollaterals = 0;

        uint collateralAmountNew = collateralAmount + addCollateral;

        IERC20Standard token = collateralToken;
        if (collateralAmountNew > 0) {
            uint collateralPrice = iFSFIConfig.getLatestPrice(token, false);
            (uint ltv, uint threshold) = iFSFIConfig.getThreshold();
            totalCollaterals +=
                (collateralAmountNew * collateralPrice * (threshold)) /
                10000 /
                (10 ** token.decimals());
        }

        uint totalLoan = (currentDebt * stableCoinPrice) /
            (10 ** initLoan.stableCoin.decimals());

        uint healthFactor = (totalCollaterals * 100) / totalLoan;
        return healthFactor;
    }

    /// @notice swapExactOutputSingle swaps a minimum possible amount of DAI for a fixed amount of WETH.
    /// @dev The calling address must approve this contract to spend its DAI for this function to succeed. As the amount of input DAI is variable,
    /// the calling address will need to approve for a slightly higher amount, anticipating some variance.
    /// @param amountOut The exact amount of WETH9 to receive from the swap.
    /// @param amountInMaximum The amount of DAI we are willing to spend to receive the specified amount of WETH9.
    /// @return amountIn The amount of DAI actually spent in the swap.
    function swapTokenForUSD(
        uint256 amountOut,
        uint256 amountInMaximum,
        IERC20Standard stableCoin,
        IERC20Standard tokenAddress
    ) internal returns (uint256 amountIn) {
        (
            IV3SwapRouter swapRouter,
            IUniswapV3Factory factory,
            IQuoterV2 quoter
        ) = iFSFIConfig.getSwapRouter();
        // Approve the router to spend the specifed `amountInMaximum` of DAI.
        // In production, you should choose the maximum amount to spend based on oracles or other data sources to acheive a better swap.
        TransferHelper.safeApprove(
            address(tokenAddress),
            address(swapRouter),
            amountInMaximum
        );

        address pool = factory.getPool(
            address(tokenAddress),
            address(stableCoin),
            feeTier
        );

        uint24 fee = IUniswapV3Pool(pool).fee();

        IV3SwapRouter.ExactOutputSingleParams memory params = IV3SwapRouter
            .ExactOutputSingleParams({
                tokenIn: address(tokenAddress),
                tokenOut: address(stableCoin),
                fee: fee,
                recipient: address(this),
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = swapRouter.exactOutputSingle(params);

        // For exact output swaps, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(
                address(tokenAddress),
                address(swapRouter),
                0
            );
        }
    }

    function swapEarnForUSD(
        uint256 amountIn,
        IERC20Standard stableCoin,
        IERC20Standard tokenAddress
    ) internal returns (uint256 amountOut) {
        (
            IV3SwapRouter swapRouter,
            IUniswapV3Factory factory,
            IQuoterV2 quoter
        ) = iFSFIConfig.getSwapRouter();
        // Approve the router to spend the specifed `amountInMaximum` of DAI.
        // In production, you should choose the maximum amount to spend based on oracles or other data sources to acheive a better swap.
        TransferHelper.safeApprove(
            address(tokenAddress),
            address(swapRouter),
            amountIn
        );

        address pool = factory.getPool(
            address(tokenAddress),
            address(stableCoin),
            feeTier
        );

        uint24 fee = IUniswapV3Pool(pool).fee();

        // slippage 1%
        uint256 outputExpected = (amountIn *
            iFSFIConfig.getLatestPrice(tokenAddress, false) *
            99) /
            iFSFIConfig.getLatestPrice(stableCoin, true) /
            100;

        IV3SwapRouter.ExactInputSingleParams memory params = IV3SwapRouter
            .ExactInputSingleParams({
                tokenIn: address(tokenAddress),
                tokenOut: address(stableCoin),
                fee: fee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: outputExpected,
                sqrtPriceLimitX96: 0
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        amountOut = swapRouter.exactInputSingle(params);
    }

    function quoteEarnForUSD(
        uint256 amountIn,
        IERC20Standard stableCoin,
        IERC20Standard tokenAddress
    ) internal returns (uint256) {
        (
            IV3SwapRouter swapRouter,
            IUniswapV3Factory factory,
            IQuoterV2 quoter
        ) = iFSFIConfig.getSwapRouter();

        address pool = factory.getPool(
            address(tokenAddress),
            address(stableCoin),
            feeTier
        );

        uint24 fee = IUniswapV3Pool(pool).fee();

        IQuoterV2.QuoteExactInputSingleParams memory params = IQuoterV2
            .QuoteExactInputSingleParams({
                tokenIn: address(tokenAddress),
                tokenOut: address(stableCoin),
                fee: fee,
                amountIn: amountIn,
                sqrtPriceLimitX96: 0
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        (
            uint256 amountOut,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        ) = quoter.quoteExactInputSingle(params);

        return amountOut;
    }

    function liquidate(
        uint _currentDebt
    ) public onlyOwner returns (uint256, uint256, uint256, uint256) {
        require(
            getHealthFactor(_currentDebt, 0) < 100,
            Errors.CAN_NOT_LIQUIDATE
        );
        initLoan.closedAmount = initLoan.amount;

        (uint earnLender, uint earnBorrower, uint earnPlatform) = iFSFIConfig
            .getEarnShare();

        // get all collateral from aave
        if (isStakeAave) {
            IERC20Standard aToken = iFSFIConfig.getAtoken(collateralToken);
            initLoan.closedAmount =
                (aToken.balanceOf(address(this)) *
                    (10 ** collateralToken.decimals())) /
                (10 ** aToken.decimals());
            withdrawLiquidity(earnPlatform, earnBorrower, earnLender);
        }

        (uint outUSD, uint amountOut) = calculateSwap(_currentDebt);

        (
            uint lender1,
            uint lender2,
            uint platform1,
            uint liquidator1
        ) = calculateLiquidation(_currentDebt, amountOut);

        initLoan.isLiquidated = true;
        initLoan.isClosed = true;

        initLoan.stableCoin.approve(fsfi, outUSD);
        return (lender1, lender2, platform1, liquidator1);
    }

    function calculateSwap(uint _currentDebt) public returns (uint, uint) {
        (
            uint penaltyLender,
            uint penaltyLiquidator,
            uint penaltyPlatform
        ) = iFSFIConfig.getPenalty();
        uint totalPenalty = penaltyLender + penaltyLiquidator + penaltyPlatform;
        uint amountOut = 0;
        if (shareLender + sharePlatform > 0) {
            amountOut = quoteEarnForUSD(
                shareLender + sharePlatform,
                collateralToken,
                initLoan.stableCoin
            );
            // slippage 1%
            require(
                (((iFSFIConfig.getLatestPrice(collateralToken, false) *
                    (shareLender + sharePlatform)) /
                    iFSFIConfig.getLatestPrice(initLoan.stableCoin, true)) *
                    99) /
                    100 <=
                    amountOut,
                Errors.OVER_SLIPPAGE
            );
        }
        uint penalty = (_currentDebt * totalPenalty) / 10000;
        uint amountSwap = _currentDebt + penalty + amountOut;
        uint outUSD = swapTokenForUSD(
            amountSwap,
            collateralToken.balanceOf(address(this)),
            initLoan.stableCoin,
            collateralToken
        );

        return (outUSD, amountOut);
    }

    function calculateLiquidation(
        uint _currentDebt,
        uint _amountOut
    ) public view returns (uint, uint, uint, uint) {
        uint earnLender;
        uint earnPlatform;
        {
            (
                uint _earnLender,
                uint earnBorrower,
                uint _earnPlatform
            ) = iFSFIConfig.getEarnShare();

            earnLender = _earnLender;
            earnPlatform = _earnPlatform;
        }
        (
            uint penaltyLender,
            uint penaltyLiquidator,
            uint penaltyPlatform
        ) = iFSFIConfig.getPenalty();

        uint totalPenalty = penaltyLender + penaltyLiquidator + penaltyPlatform;
        uint penalty = (_currentDebt * totalPenalty) / 10000;
        // uint lender1 = (penalty * penaltyLender) / totalPenalty;
        uint platform1 = (penalty * penaltyPlatform) / totalPenalty;
        // uint liquidator1 = penalty -
        //     ((penalty * penaltyLender) / totalPenalty) -
        //     platform1;
        uint lender2 = (_amountOut * earnLender) / (earnLender + earnPlatform);
        uint platform2 = _amountOut - lender2;
        return (
            (penalty * penaltyLender) / totalPenalty,
            lender2,
            platform1 + platform2,
            penalty - ((penalty * penaltyLender) / totalPenalty) - platform1
        );
    }

    function updateCollateral(uint amount) external onlyOwner {
        collateralAmount += amount;
        collateralToken.transferFrom(fsfi, address(this), amount);
    }

    function closeLoan() public onlyOwner returns (uint256, uint256) {
        (
            IV3SwapRouter swapRouter,
            IUniswapV3Factory factory,
            IQuoterV2 quoter
        ) = iFSFIConfig.getSwapRouter();
        (uint earnLender, uint earnBorrower, uint earnPlatform) = iFSFIConfig
            .getEarnShare();
        initLoan.isClosed = true;
        initLoan.closedAmount = initLoan.amount;
        if (isStakeAave) {
            IERC20Standard aToken = iFSFIConfig.getAtoken(collateralToken);
            initLoan.closedAmount =
                (aToken.balanceOf(address(this)) *
                    (10 ** collateralToken.decimals())) /
                (10 ** aToken.decimals());
            withdrawLiquidity(earnPlatform, earnBorrower, earnLender);
        }

        if (shareLender + sharePlatform > 0) {
            collateralToken.approve(
                address(swapRouter),
                shareLender + sharePlatform
            );
            uint outUSD = swapEarnForUSD(
                shareLender + sharePlatform,
                initLoan.stableCoin,
                collateralToken
            );
            initLoan.stableCoin.approve(fsfi, outUSD);
            uint usdLender = (earnLender * outUSD) /
                (earnLender + earnPlatform);
            uint usdPlatform = outUSD - usdLender;
            return (usdLender, usdPlatform);
        }
        return (0, 0);
    }

    function withdrawAllCollateral(
        address _receiver,
        bool _isETH
    ) public onlyOwner {
        require(
            initLoan.isClosed == true && initLoan.isFinalty == false,
            Errors.LOAN_IS_NOT_CLOSED_OR_FINALTY
        );
        if (_isETH) {
            IWETH wETH = iFSFIConfig.getWETH();
            wETH.withdraw(collateralToken.balanceOf(address(this)));
            payable(_receiver).transfer(
                collateralToken.balanceOf(address(this))
            );
        } else {
            collateralToken.transfer(
                _receiver,
                collateralToken.balanceOf(address(this))
            );
        }
        initLoan.isFinalty = true;
    }

    function getLoanInfo() public view returns (DataTypes.Loan memory) {
        return initLoan;
    }

    function getYieldEarned(uint _earnBorrower) public view returns (uint) {
        IERC20Standard aToken = iFSFIConfig.getAtoken(collateralToken);
        uint current = aToken.balanceOf(address(this));
        uint earned = (current * (10 ** collateralToken.decimals())) /
            (10 ** aToken.decimals()) -
            collateralAmount;
        return (earned * _earnBorrower) / 10000;
    }

    function getIsYeild() public view returns (bool) {
        return isStakeAave;
    }

    function getCollateralAmount() public view returns (uint) {
        return collateralAmount;
    }

    function getCollateralToken() public view returns (IERC20Standard) {
        return collateralToken;
    }

    receive() external payable {}
}
