import logging

import algokit_utils

logger = logging.getLogger(__name__)


def deploy() -> None:
    from smart_contracts.artifacts.asa_terminal.asa_terminal_client import (
        AsaTerminalFactory,
        AsaTerminalMethodCallCreateParams,  # ✅ Import the typed class from the generated client
    )

    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer_ = algorand.account.from_environment("DEPLOYER")

    factory = algorand.client.get_typed_app_factory(
        AsaTerminalFactory, default_sender=deployer_.address
    )

    app_client, result = factory.deploy(
        on_update=algokit_utils.OnUpdate.AppendApp,
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
        create_params=AsaTerminalMethodCallCreateParams(  # ✅ Use the typed class
            method="create()void",  # ✅ Full ABI signature, not just "create"
        ),
    )

    if result.operation_performed in [
        algokit_utils.OperationPerformed.Create,
        algokit_utils.OperationPerformed.Replace,
    ]:
        algorand.send.payment(
            algokit_utils.PaymentParams(
                amount=algokit_utils.AlgoAmount(algo=1),
                sender=deployer_.address,
                receiver=app_client.app_address,
            )
        )

    logger.info(
        f"Deployed {app_client.app_name} ({app_client.app_id}), "
        f"operation: {result.operation_performed}"
    )
