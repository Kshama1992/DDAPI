from constructs import Construct
from aws_cdk import(
    Stage,
    Environment,
)

from dropdesk_infra.constructs.dropdesk_deployment_params import DropdeskDeploymentParams
from .dropdesk_infra_stack import DropdeskInfraStack

class DropdeskPipelineStage(Stage):
    def __init__(self, scope: Construct, id: str, env: Environment, params: DropdeskDeploymentParams, **kwargs):
        super().__init__(scope, id, env=env, **kwargs)
        service = DropdeskInfraStack(self, 'DropDeskBeInfra', env, params, **kwargs)
