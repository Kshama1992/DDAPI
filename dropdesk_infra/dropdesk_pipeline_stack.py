from constructs import Construct
from aws_cdk import (
    SecretValue,
    Stack,
    Environment,
    pipelines as pipelines,
)
from dropdesk_infra.constructs.dropdesk_deployment_params import DropdeskDeploymentParams
from aws_cdk import pipelines
from aws_cdk.pipelines import CodeBuildStep
from .dropdesk_infra_deploy_stage import DropdeskPipelineStage
from aws_cdk.aws_codebuild import BuildEnvironment, ComputeType

class DropdeskPipelineStack(Stack):
    def __init__(self, scope: Construct, id: str, env: Environment, **kwargs) -> None:
        super().__init__(scope, id, env=env, **kwargs)

        pipeline = pipelines.CodePipeline(
            self,
            "Pipeline",
            pipeline_name="api-pipeline",
            cross_account_keys=True,
            
            synth=CodeBuildStep(
                "Synth",
                input=pipelines.CodePipelineSource.git_hub('dropdeskllc/api', 'main', authentication=SecretValue.secrets_manager('github-access-token')),
                commands=[
                    "npm install -g aws-cdk",
                    "pip install -r requirements.txt",
                    "cdk synth",
                ],
                build_environment=BuildEnvironment(
                    compute_type=ComputeType.LARGE,
                ),
                primary_output_directory="cdk.out"
            )
        )

        dev_build_args = {
            "PRIVATE_KEY_PASSPHRASE": "bXa9PD2WAPEJcAuV9UNB3ZPJLEYHwNsZ",
            "REFRESH_TOKEN_PASSPHRASE": "u8Em5DY54gam524ah2BhYWSVWhHZy8RPwgqLj9vxs8AzCU"
        }
        deploy_to_dev = DropdeskPipelineStage(self,
                                              "Dev-Deploy",
                                              env=Environment(account="267382717105", region="us-east-1"),
                                              params=DropdeskDeploymentParams(domain_name="dev-api.devhz.dropdesk.net",
                                                                              hosted_zone_id="Z050737125WS3ZVVRV0SS",
                                                                              zone_name="devhz.dropdesk.net",
                                                                              availability_zones=2,
                                                                              build_args=dev_build_args,
                                                                              memory_in_gb=8,
                                                                              fargate_spot_ratio=9,
                                                                              fargate_ratio=1,
                                                                              cookie_domain='.dropdesk.net',
                                                                              v2_domain_name="dev-apiv2.devhz.dropdesk.net",
                                                                              v2_venue_api_domain="venue-api.devhz.dropdesk.net/api",
                                                                              auth_client_domain="dd-dev-user",
                                                                              auth_admin_client_domain="dd-dev-admin",
                                                                              allow_origin="*",
                                                                              domain_certificate="arn:aws:acm:us-east-1:267382717105:certificate/667f902b-2792-4715-af84-d8a743eed606",
                                                                              deregistration_delay=10
                                                                              ))

        pipeline.add_stage(deploy_to_dev)

        test_build_args = {
            "PRIVATE_KEY_PASSPHRASE": "bXa9PD2WAPEJcAuV9UNB3ZPJLEYHwNsZ",
            "REFRESH_TOKEN_PASSPHRASE": "u8Em5DY54gam524ah2BhYWSVWhHZy8RPwgqLj9vxs8AzCU"
        }
        deploy_to_test = DropdeskPipelineStage(self,
                                               "Test-Deploy",
                                               env=Environment(account="204731301848", region="us-east-1"),
                                               params=DropdeskDeploymentParams(domain_name="test-api.testhz.dropdesk.net",
                                                                               hosted_zone_id="Z00343412UORVW2FNU3JN",
                                                                               zone_name="testhz.dropdesk.net",
                                                                               availability_zones=2,
                                                                               build_args=test_build_args,
                                                                               memory_in_gb=8,
                                                                               fargate_spot_ratio=9,
                                                                               fargate_ratio=1,
                                                                               cookie_domain='.dropdesk.net',
                                                                               v2_domain_name="test-apiv2.testhz.dropdesk.net",
                                                                               v2_venue_api_domain="venue-api.testhz.dropdesk.net/api",
                                                                               auth_client_domain="dd-test-user",
                                                                               auth_admin_client_domain="dd-test-admin",
                                                                               allow_origin="*",
                                                                               domain_certificate="arn:aws:acm:us-east-1:204731301848:certificate/17a0651e-96eb-48e0-b983-2d85db9d757f",
                                                                               deregistration_delay=10
                                                                               ))

        pipeline.add_stage(deploy_to_test, pre=[pipelines.ManualApprovalStep('pushToTest', comment="Promote To Test")])

        prod_build_args = {
            "PRIVATE_KEY_PASSPHRASE": "mhtnxZStngEjcudUv9m9HFmvEezM3ZDVJayZTk2rk",
            "REFRESH_TOKEN_PASSPHRASE": "cjS7PZjHYTSRW3jCMbJbFnzy7CHDWGG4jxgBuQ5fL"
        }
        deploy_to_prod = DropdeskPipelineStage(self,
                                               "Prod-Backend",
                                               env=Environment(account="990375519445", region="us-east-1"),
                                               params=DropdeskDeploymentParams(domain_name="api.drop-desk.com",
                                                                               hosted_zone_id="Z017184324PEND3VVW9SM",
                                                                               zone_name="drop-desk.com",
                                                                               availability_zones=2,
                                                                               build_args=prod_build_args,
                                                                               memory_in_gb=8,
                                                                               fargate_spot_ratio=1,
                                                                               fargate_ratio=1,
                                                                               cookie_domain='.drop-desk.com',
                                                                               cpu=4096,
                                                                               v2_domain_name="apiv2.drop-desk.com",
                                                                               v2_venue_api_domain="venue-api.drop-desk.com/api",
                                                                               auth_client_domain="dd-user",
                                                                               auth_admin_client_domain="dd-admin",
                                                                               allow_origin="*",
                                                                               domain_certificate="arn:aws:acm:us-east-1:990375519445:certificate/68022547-e30c-4dce-bd15-65fe54fda53d",
                                                                               deregistration_delay=60
                                                                               ))

        pipeline.add_stage(deploy_to_prod, pre=[pipelines.ManualApprovalStep('pushToProd', comment="Promote To Production")])
