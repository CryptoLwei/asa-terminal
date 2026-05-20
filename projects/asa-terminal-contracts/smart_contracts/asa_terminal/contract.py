# asa_terminal.py
# AsaTerminal — ARC-4 contract on Algorand (Puya)
# No-code ASA minting with support for Fungible Tokens and proper NFTs.

import typing
from algopy import ARC4Contract, Asset, Global, GlobalState, Txn, UInt64, arc4, itxn, op


class AsaTerminal(ARC4Contract):
    """
    AsaTerminal: ARC-4 contract for no-code ASA minting (Fungible + NFT).
    """

    def __init__(self) -> None:
        self.admin = GlobalState(arc4.Address)

    # ── Deployment ────────────────────────────────────────────────────────────

    @arc4.abimethod(create="require")
    def create(self) -> None:
        """Initialises the contract and sets the deployer as admin."""
        self.admin.value = arc4.Address(Txn.sender)

    # ── Admin Management ──────────────────────────────────────────────────────

    @arc4.abimethod
    def set_admin(self, new_admin: arc4.Address) -> None:
        """Transfers admin rights. Only current admin can call."""
        assert self.admin.value == arc4.Address(Txn.sender), "Only admin can set new admin"
        self.admin.value = new_admin

    @arc4.abimethod(readonly=True)
    def get_admin(self) -> arc4.Address:
        """Returns the current admin address."""
        return self.admin.value

    # ── ASA Opt-In & Balance ──────────────────────────────────────────────────

    @arc4.abimethod
    def opt_in_to_asset(self, asset: Asset) -> None:
        """Opts the contract into an ASA. Only callable by admin."""
        assert self.admin.value == arc4.Address(Txn.sender), "Only admin can opt in"
        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_receiver=Global.current_application_address,
            asset_amount=0,
            fee=0,
        ).submit()

    @arc4.abimethod(readonly=True)
    def get_asset_balance(self, asset: Asset) -> UInt64:
        """Returns the contract's balance of a given ASA."""
        balance, exists = op.AssetHoldingGet.asset_balance(
            Global.current_application_address, asset
        )
        assert exists, "Contract has not opted into this asset"
        return balance

    # ── No-Code ASA Minting ───────────────────────────────────────────────────

    @arc4.abimethod
    def create_asset(
        self,
        asset_name: arc4.String,
        unit_name: arc4.String,
        total: UInt64,
        decimals: UInt64,
        url: arc4.String,
        metadata_hash: arc4.StaticArray[arc4.UInt8, typing.Literal[32]],  # ← Fixed: exactly 32 bytes, no length prefix
    ) -> UInt64:
        """
        Creates a new ASA (Fungible Token or NFT).

        - For NFTs: total=1, decimals=0, pass metadata_hash (sha512_256 of the JSON)
        - For Fungible Tokens: total > 1 or decimals > 0
        - Pass empty string for url and 32 zero bytes for metadata_hash if not needed.
        """
        assert total > 0, "Total supply must be greater than 0"
        assert decimals <= 19, "Decimals must be <= 19"

        mint_result = itxn.AssetConfig(
            total=total,
            decimals=decimals,
            asset_name=asset_name.bytes,
            unit_name=unit_name.bytes,
            url=url.bytes,
            metadata_hash=metadata_hash.bytes,  # StaticArray.bytes = exactly 32 bytes
            manager=Txn.sender,
            reserve=Txn.sender,
            fee=0,
        ).submit()

        return mint_result.created_asset.id

    # ── Claim Asset ───────────────────────────────────────────────────────────

    @arc4.abimethod
    def claim_asset(self, asset: Asset) -> None:
        """Transfers the full balance of the asset to the caller."""
        balance, exists = op.AssetHoldingGet.asset_balance(
            Global.current_application_address, asset
        )
        assert exists, "Contract does not hold this asset"
        assert balance > UInt64(0), "No balance to claim"

        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_receiver=Txn.sender,
            asset_amount=balance,
            fee=0,
        ).submit()
