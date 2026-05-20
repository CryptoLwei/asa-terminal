# tests/test_create_asset.py
# Integration test for AsaTerminal create_asset() → claim_asset() two-step flow.
# Run with: pytest tests/test_create_asset.py -v


import uuid

import algokit_utils
import pytest
from algokit_utils import AlgoAmount, AlgorandClient

from smart_contracts.artifacts.asa_terminal.asa_terminal_client import (
    AsaTerminalFactory,
    AsaTerminalMethodCallCreateParams,
)


@pytest.fixture(scope="session")
def algorand() -> AlgorandClient:
    """LocalNet Algorand client."""
    return AlgorandClient.from_environment()


@pytest.fixture(scope="session")
def deployer(algorand: AlgorandClient):
    """Funded deployer account from environment."""
    return algorand.account.from_environment("DEPLOYER")


@pytest.fixture(scope="function")
def user(algorand: AlgorandClient, deployer):
    """
    A separate user account — simulates the non-technical user
    pressing 'Create Token' in the terminal UI.
    """
    user_account = algorand.account.random()
    # Fund user with 2 ALGO: enough for MBR + opt-in + fees
    algorand.send.payment(
        algokit_utils.PaymentParams(
            sender=deployer.address,
            receiver=user_account.address,
            amount=AlgoAmount(algo=2),
            signer=deployer.signer,
        )
    )
    return user_account


@pytest.fixture(scope="function")
def app_client(algorand: AlgorandClient, deployer):
    """Deploy a fresh AsaTerminal contract for the test session."""
    factory = algorand.client.get_typed_app_factory(
        AsaTerminalFactory,
        default_sender=deployer.address,
        default_signer=deployer.signer,
        app_name=f"AsaTerminal_{uuid.uuid4().hex[:8]}",  # unique name per test
    )
    app_client, _ = factory.deploy(
        on_update=algokit_utils.OnUpdate.AppendApp,
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
        create_params=AsaTerminalMethodCallCreateParams(method="create()void"),
    )
    # Fund the contract to cover MBR for holding the asset mid-flight
    algorand.send.payment(
        algokit_utils.PaymentParams(
            sender=deployer.address,
            receiver=app_client.app_address,
            amount=AlgoAmount(algo=1),
            signer=deployer.signer,
        )
    )
    return app_client


# ─── Tests ────────────────────────────────────────────────────────────────────


def test_create_asset_returns_asset_id(app_client, user, algorand):
    """
    STEP 1 — Call create_asset() as the user.
    Assert: a non-zero Asset ID is returned.
    The supply stays inside the contract until claim_asset() is called.
    """
    result = app_client.send.create_asset(
        args=(
            "Lwei Token",  # asset_name
            "LWEI",  # unit_name
            1_000_000,  # total supply
            0,  # decimals (whole tokens)
            "https://cryptolwei.io/token.json",  # url
        ),
        params=algokit_utils.CommonAppCallParams(
            sender=user.address,
            signer=user.signer,
            extra_fee=AlgoAmount.from_micro_algo(
                2000
            ),  # 1 outer + 1 inner (AssetConfig)
        ),
    )

    asset_id = result.abi_return
    assert asset_id is not None
    assert asset_id > 0
    print(f"\n✅ Asset created — ID: {asset_id}")


def test_full_mint_flow(app_client, user, algorand):
    """
    Full two-step terminal flow:
      Step 1 — create_asset()  → get Asset ID, supply held in contract
      Step 2 — user opts in    → wallet accepts the new asset
      Step 3 — claim_asset()   → contract pushes full supply to user
    Assert: user's final balance equals total supply minted.
    """
    TOTAL_SUPPLY = 1_000_000

    # ── Step 1: Mint ──────────────────────────────────────────────────────────
    mint_result = app_client.send.create_asset(
        args=(
            "Lwei Token",
            "LWEI",
            TOTAL_SUPPLY,
            0,
            "https://cryptolwei.io/token.json",
        ),
        params=algokit_utils.CommonAppCallParams(
            sender=user.address,
            signer=user.signer,
            extra_fee=AlgoAmount.from_micro_algo(2000),
        ),
    )

    asset_id = mint_result.abi_return
    assert asset_id is not None and asset_id > 0
    print(f"\n✅ Step 1 — Minted Asset ID: {asset_id}")

    # ── Step 2: User opts in ──────────────────────────────────────────────────
    algorand.send.asset_opt_in(
        algokit_utils.AssetOptInParams(
            sender=user.address,
            signer=user.signer,
            asset_id=asset_id,
        )
    )
    print(f"✅ Step 2 — User opted in to Asset ID: {asset_id}")

    # ── Step 3: Claim ─────────────────────────────────────────────────────────
    app_client.send.claim_asset(
        args=(asset_id,),
        params=algokit_utils.CommonAppCallParams(
            sender=user.address,
            signer=user.signer,
            extra_fee=AlgoAmount.from_micro_algo(
                1000
            ),  # 1 outer + 1 inner (AssetTransfer)
        ),
    )
    print("✅ Step 3 — Supply claimed by user")

    # ── Assert: user holds full supply ────────────────────────────────────────
    account_info = algorand.account.get_information(user.address)
    user_asset_balance = next(
        (a["amount"] for a in (account_info.assets or []) if a["asset-id"] == asset_id),
        0,
    )
    assert user_asset_balance == TOTAL_SUPPLY
    print(f"✅ Final balance confirmed: {user_asset_balance} LWEI in user wallet")
