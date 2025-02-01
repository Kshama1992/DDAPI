from calendar import c
from logging import root
from aws_cdk import (
    SecretValue,
    Stack,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    Duration,
    aws_ssm as ssm,
    aws_elasticloadbalancingv2 as ec2_lb,
    aws_route53 as route53,
    Environment,
)
from aws_cdk import aws_secretsmanager as secretsmanager
from aws_cdk import aws_cognito_identitypool_alpha as cognito_identitypool
from aws_cdk.aws_cognito_identitypool_alpha import (  
    UserPoolAuthenticationProvider,  
) 
from aws_cdk.aws_ecs import CapacityProviderStrategy
from constructs import Construct
from dropdesk_infra.constructs.dropdesk_deployment_params import DropdeskDeploymentParams

from aws_cdk import aws_certificatemanager as certificate 
import aws_cdk.aws_cognito as cognito
import aws_cdk.aws_apigateway as apigateway
import aws_cdk.aws_route53 as route53
import aws_cdk.aws_route53_targets as targets
import aws_cdk.aws_iam as iam

class DropdeskInfraStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, env: Environment, params: DropdeskDeploymentParams, **kwargs) -> None:
        super().__init__(scope, construct_id, env = env)

        infra_name = 'dd-infra'
        component_name = 'be'

        nomenclature = f'{infra_name}-{component_name}'

        backend_vpc = ec2.Vpc.from_lookup(self, 'default-vpc', is_default=True)

        backend_cluster = ecs.Cluster(self, f'{nomenclature}-cluster', vpc=backend_vpc)

        environment = {
            "NODE_OPTIONS":ssm.StringParameter.from_string_parameter_name(self, 'node_options', "/api/node_options").string_value,
            "NODE_ENV": ssm.StringParameter.from_string_parameter_name(self, 'node_env', "/api/node_env").string_value,
            "APP_PORT": ssm.StringParameter.from_string_parameter_name(self, 'app_port', '/api/app_port').string_value,
            "APP_MAX_UPLOAD_SIZE": ssm.StringParameter.from_string_parameter_name(self, 'app_max_upload_size', '/api/app_max_upload_size').string_value,
            "APP_API_URL_PREFIX": "",
            "APP_CACHE_TIME": ssm.StringParameter.from_string_parameter_name(self, 'app_cache_time', '/api/app_cache_time').string_value,

            "REDIS_PORT": ssm.StringParameter.from_string_parameter_name(self, 'redis_port', '/api/redis_port').string_value,
            "REDIS_HOST": ssm.StringParameter.from_string_parameter_name(self, 'redis_host', '/api/redis_host').string_value,

            "POSTGRES_HOST": ssm.StringParameter.from_string_parameter_name(self, 'postgres_host', "/api/postgres_host").string_value,
            "POSTGRES_PORT": ssm.StringParameter.from_string_parameter_name(self, 'postgres_port', '/api/postgres_port').string_value,
            "POSTGRES_DB": ssm.StringParameter.from_string_parameter_name(self, 'postgres_db', '/api/postgres_db').string_value,
            "POSTGRES_USER": ssm.StringParameter.from_string_parameter_name(self, 'postgres_user', '/api/postgres_user').string_value,
            "POSTGRES_PASSWORD": ssm.StringParameter.from_string_parameter_name(self, 'postgres_pass', "/api/postgres_pass").string_value,
            "POSTGRES_ENCODING": ssm.StringParameter.from_string_parameter_name(self, 'postgres_encoding', '/api/postgres_encoding').string_value,
            "POSTGRES_MULTIPLE_DATABASES": ssm.StringParameter.from_string_parameter_name(self, 'postgres_multiple_databases', '/api/postgres_multiple_databases').string_value,
            "PGADMIN_DEFAULT_PASSWORD": ssm.StringParameter.from_string_parameter_name(self, 'pgadmin_default_password', '/api/pgadmin_default_password').string_value,
            "PGADMIN_DEFAULT_EMAIL": ssm.StringParameter.from_string_parameter_name(self, 'pgadmin_default_email', '/api/pgadmin_default_email').string_value,

            "STRIPE_WEBHOOK_SECRET": ssm.StringParameter.from_string_parameter_name(self, 'stripe_webhook_secret', '/api/stripe_webhook_secret').string_value,
            "STRIPE_PUBLISH_KEY": ssm.StringParameter.from_string_parameter_name(self, 'stripe_publish_key', '/api/stripe_publish_key').string_value,
            "STRIPE_SECRET_KEY": ssm.StringParameter.from_string_parameter_name(self, 'stripe_secret_key', '/api/stripe_secret_key').string_value,
            "STRIPE_API_VERSION": ssm.StringParameter.from_string_parameter_name(self, 'stripe_api_version', '/api/stripe_api_version').string_value,

            "TWILIO_SID": ssm.StringParameter.from_string_parameter_name(self, 'twilio_sid', '/api/twilio_sid').string_value,
            "TWILIO_API_KEY_SID": ssm.StringParameter.from_string_parameter_name(self, 'twilio_api_key_sid', '/api/twilio_api_key_sid').string_value,
            "TWILIO_API_KEY_SECRET": ssm.StringParameter.from_string_parameter_name(self, 'twilio_api_key_secret', '/api/twilio_api_key_secret').string_value,
            "TWILIO_FROM": ssm.StringParameter.from_string_parameter_name(self, 'twilio_from', '/api/twilio_from').string_value,
            "TWILIO_DEFAULT_FROM": ssm.StringParameter.from_string_parameter_name(self, 'twilio_default_from', '/api/twilio_default_from').string_value,
            "TWILIO_CONVERSATION_SERVICE_SID":ssm.StringParameter.from_string_parameter_name(self, 'twilio_conversation_service_sid', '/api/twilio_conversation_service_sid').string_value,
            "TWILIO_DEFAULT_MESSAGING_CONVERSATION_SERVICE_SID":ssm.StringParameter.from_string_parameter_name(self, 'twilio_default_messaging_conversation_service_sid', '/api/twilio_default_messaging_conversation_service_sid').string_value,
            "TWILIO_DEVELOPERS_PHONES": ssm.StringParameter.from_string_parameter_name(self, 'twilio_developers_phones', '/api/twilio_developers_phones').string_value,
            "TWILIO_AUTH_TOKEN": ssm.StringParameter.from_string_parameter_name(self, 'twilio_auth_token', '/api/twilio_auth_token').string_value,
            "TWILIO_WEBHOOK_URL": ssm.StringParameter.from_string_parameter_name(self, 'twilio_webhook_url', '/api/twilio_webhook_url').string_value,

            "MAILGUN_API_KEY": ssm.StringParameter.from_string_parameter_name(self, 'mailgun_api_key', '/api/mailgun_api_key').string_value,
            "MAILGUN_DOMAIN": ssm.StringParameter.from_string_parameter_name(self, 'mailgun_domain', '/api/mailgun_domain').string_value,

            "PRIVATE_KEY_PASSPHRASE": ssm.StringParameter.from_string_parameter_name(self, 'private_key_passphrase', '/api/private_key_passphrase').string_value,
            "REFRESH_TOKEN_PASSPHRASE": ssm.StringParameter.from_string_parameter_name(self, 'refresh_token_passphrase', '/api/refresh_token_passphrase').string_value,
            "TOKEN_EXPIRE": ssm.StringParameter.from_string_parameter_name(self, 'token_expire', '/api/token_expire').string_value,
            "COOKIE_TOKEN_PREFIX": ssm.StringParameter.from_string_parameter_name(self, 'cookie_token_prefix', '/api/cookie_token_prefix').string_value,

            "S3_BUCKET_NAME": ssm.StringParameter.from_string_parameter_name(self, 's3_bucket_name', '/api/s3_bucket_name').string_value,
            "DOMAIN": ssm.StringParameter.from_string_parameter_name(self, 'domain', '/api/domain').string_value,
            "API_DOMAIN": ssm.StringParameter.from_string_parameter_name(self, 'api_domain', '/api/api_domain').string_value,
            "DEFAULT_BRAND_NAME": ssm.StringParameter.from_string_parameter_name(self, 'default_brand_name', '/api/default_brand_name').string_value,
            "DEFAULT_ROLE_NAME": ssm.StringParameter.from_string_parameter_name(self, 'default_role_name', '/api/default_role_name').string_value,

            "MEDIA_URL": ssm.StringParameter.from_string_parameter_name(self, 'media_url', '/api/media_url').string_value,

            "SMS_BOOKING_URL": ssm.StringParameter.from_string_parameter_name(self, 'sms_booking_url', '/api/sms_booking_url').string_value,
            "SMS_ACTIVITY_URL": ssm.StringParameter.from_string_parameter_name(self, 'sms_activity_url', '/api/sms_activity_url').string_value,
            "S3_SECRET_ACCESS_KEY": ssm.StringParameter.from_string_parameter_name(self, 's3_secret_access_key', '/api/s3_secret_access_key').string_value,
            "S3_ACCESS_KEY_ID": ssm.StringParameter.from_string_parameter_name(self, 's3_access_key_id', '/api/s3_access_key_id').string_value,
            "AWS_ACCESS_KEY_ID": ssm.StringParameter.from_string_parameter_name(self, 'aws_access_key_id', '/api/s3_access_key_id').string_value,
            "AWS_SECRET_ACCESS_KEY": ssm.StringParameter.from_string_parameter_name(self, 'aws_secret_access_key', '/api/s3_secret_access_key').string_value,
            "FAILEDSMSNOTIFMAILTO" : ssm.StringParameter.from_string_parameter_name(self, 'failedsmsnotifmailto', '/api/failedsmsnotifmailto').string_value,
            "FAILEDSMSNOTIFMAILFROM" : ssm.StringParameter.from_string_parameter_name(self, 'failedsmsnotifmailfrom', '/api/failedsmsnotifmailfrom').string_value,
            "COOKIE_DOMAIN": params.cookie_domain,
            "PHONE_NUMBER_SERVICE_API":ssm.StringParameter.from_string_parameter_name(self,'phone_number_service_api','/api/phone_number_service_api').string_value,
            "TWILIO_VENUE_ONBOARDING_FROM":ssm.StringParameter.from_string_parameter_name(self,'twilio_venue_onboarding_from','/api/twilio_venue_onboarding_from').string_value
        }

        service = ecs_patterns.ApplicationLoadBalancedFargateService(self,
                                                                     f'{nomenclature}-fargate-service',
                                                                     cluster=backend_cluster,
                                                                     assign_public_ip=True,
                                                                     cpu=params.cpu,
                                                                     desired_count=2,
                                                                     enable_execute_command=True,
                                                                     task_subnets=ec2.SubnetSelection(availability_zones=["us-east-1d", "us-east-1f"],
                                                                                                      one_per_az=True,
                                                                                                      subnet_type=ec2.SubnetType.PUBLIC),
                                                                     protocol=ec2_lb.ApplicationProtocol.HTTPS,
                                                                     domain_name=params.domain_name,
                                                                     domain_zone=route53.HostedZone.from_hosted_zone_attributes(self,
                                                                                                                                f'{nomenclature}-hosted-zone',
                                                                                                                                hosted_zone_id=params.hosted_zone_id,
                                                                                                                                zone_name=params.zone_name),
                                                                     redirect_http=True,
                                                                     task_image_options=ecs_patterns.ApplicationLoadBalancedTaskImageOptions(environment=environment,
                                                                                                                                             image=ecs.ContainerImage.from_asset('.',
                                                                                                                                                                                 file='Dockerfile',
                                                                                                                                                                                 build_args=params.build_args,
                                                                                                                                                                                 exclude=["cdk.out", ".vscode", ".venv", "node_modules", "app.py", "cdk.json", "requirements-dev.txt", "requirements.txt", "source.bat", "dropdesk_infra", "tests"]),
                                                                                                                                             container_port=3000),
                                                                     memory_limit_mib=(params.memory_in_gb * 1024),
                                                                     public_load_balancer=True,
                                                                     health_check_grace_period=Duration.seconds(240),
                                                                     capacity_provider_strategies=[
                                                                         CapacityProviderStrategy(
                                                                             capacity_provider="FARGATE_SPOT",
                                                                             base=0,
                                                                             weight=params.fargate_spot_ratio),
                                                                         CapacityProviderStrategy(
                                                                             capacity_provider="FARGATE",
                                                                             base=0,
                                                                             weight=params.fargate_ratio),
                                                                     ],
                                                                     )
        service.target_group.set_attribute("deregistration_delay.timeout_seconds", str(params.deregistration_delay))
        cfn_load_balancer = service.load_balancer.node.default_child
        cfn_load_balancer.subnets = backend_vpc.select_subnets(availability_zones=["us-east-1d", "us-east-1f"], one_per_az=True, subnet_type=ec2.SubnetType.PUBLIC).subnet_ids

        scalable_task_count = service.service.auto_scale_task_count(min_capacity=params.min_capacity, max_capacity=params.max_capacity)

        scalable_task_count.scale_on_cpu_utilization(f'{nomenclature}-cpu-autoscale', target_utilization_percent=params.cpu_target_utilization, scale_in_cooldown=Duration.seconds(params.cpu_scale_in_cooldown), scale_out_cooldown=Duration.seconds(params.cpu_scale_out_cooldown))

        scalable_task_count.scale_on_memory_utilization(f'{nomenclature}-mem-autoscale', target_utilization_percent=params.mem_target_utilization, scale_in_cooldown=Duration.seconds(params.mem_scale_in_cooldown), scale_out_cooldown=Duration.seconds(params.mem_scale_out_cooldown))

        user_pool = cognito.UserPool(self, "cognito-reg-user-pool",
                                     email=cognito.UserPoolEmail.with_cognito(),
                                     account_recovery=cognito.AccountRecovery.EMAIL_ONLY,

                                    #  auto_verify=cognito.AutoVerifiedAttrs(email=True,phone=True),
                                     self_sign_up_enabled=True,
                                     sign_in_aliases=cognito.SignInAliases(email=True, 
                                                                           username=True, 
                                                                           phone=True),
                                     sign_in_case_sensitive=False)

        user_pool_client=user_pool.add_client("cognito-user-client",
                            supported_identity_providers=[cognito.UserPoolClientIdentityProvider.COGNITO],
                            auth_flows=cognito.AuthFlow(
                                user_password=True,
                                user_srp=True,
                                admin_user_password=True,
                                custom=True
                                ),
                            o_auth=cognito.OAuthSettings(
                            flows=cognito.OAuthFlows(
                                implicit_code_grant=True
                                ),
                            scopes=[cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PHONE],
                            callback_urls=["https://"+params.v2_domain_name],
                            logout_urls=["https://"+params.v2_domain_name],
                            ))
        
        secretsmanager.Secret(self, "UserPoolIdSecret",
                              secret_name="UserPoolIdSecret",
                              description="Stores the User Pool ID",
                              secret_string_value=SecretValue.plain_text(user_pool.user_pool_id))
        
        secretsmanager.Secret(self, "UserPoolClientIdSecret",
                              secret_name="UserPoolClientIdSecret",
                              description="Stores the User Pool Client ID",
                              secret_string_value=SecretValue.plain_text(user_pool_client.user_pool_client_id))
        
        user_pool.add_domain("dd-user-auth-domain",
                             cognito_domain=cognito.CognitoDomainOptions(
                                 domain_prefix=params.auth_client_domain)
                            )
        
        admin_pool = cognito.UserPool(self, "cognito-admin-pool",
                                     email=cognito.UserPoolEmail.with_cognito(),
                                     account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
                                     self_sign_up_enabled=True,
                                     sign_in_aliases=cognito.SignInAliases(email=True, 
                                                                           username=True, 
                                                                           phone=True),
                                     sign_in_case_sensitive=False)
                
        admin_pool_client=admin_pool.add_client("cognito-admin-client",
                            supported_identity_providers=[cognito.UserPoolClientIdentityProvider.COGNITO],
                            auth_flows=cognito.AuthFlow(
                                user_password=True,
                                user_srp=True,
                                admin_user_password=True,
                                ),
                            o_auth=cognito.OAuthSettings(
                            flows=cognito.OAuthFlows(
                                implicit_code_grant=True
                                ),
                            scopes=[cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PHONE],
                            callback_urls=["https://"+params.v2_domain_name],
                            logout_urls=["https://"+params.v2_domain_name],
                            ))

        secretsmanager.Secret(self, "AdminPoolIdSecret",
                              secret_name="AdminPoolIdSecret",
                              description="Stores the Admin Pool ID",
                              secret_string_value=SecretValue.plain_text(admin_pool.user_pool_id))
        
        secretsmanager.Secret(self, "AdminPoolClientIdSecret",
                              secret_name="AdminPoolClientIdSecret",
                              description="Stores the Admin Pool Client ID",
                              secret_string_value=SecretValue.plain_text(admin_pool_client.user_pool_client_id))
        
        admin_pool.add_domain("dd-admin-auth-domain",
                             cognito_domain=cognito.CognitoDomainOptions(
                                 domain_prefix=params.auth_admin_client_domain)
                            )
        rest_api = apigateway.RestApi(self, "dd-auth-alb-api",
                                      default_cors_preflight_options=apigateway.CorsOptions(allow_origins=[params.allow_origin],
                                                                                              allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                                                                                              allow_headers=["Content-Type", "X-Amz-Date", "Authorization", "x-api-key", "x-amz-security-token", "x-amz-user-agent", "cache-control", "origin", "x-requested-with", "accept", "auth", "cookie", "set-cookie"],
                                                                                              max_age=Duration.days(1),
                                                                                              allow_credentials=True),
                                      endpoint_configuration=apigateway.EndpointConfiguration(types=[apigateway.EndpointType.REGIONAL]))
        
        domain_certificate=params.domain_certificate
        
        api_custom_domain=apigateway.DomainName(self,"api-gateway-custom-domain",
                              domain_name=params.v2_domain_name,
                              mapping=rest_api,
                              certificate=certificate.Certificate.from_certificate_arn(self, 'domain-cert', domain_certificate))

        cognito_auth=apigateway.CognitoUserPoolsAuthorizer(self, "api-cognito-authorizer",
                                                           cognito_user_pools=[user_pool, admin_pool])   

        guest_usage_plan = rest_api.add_usage_plan("DDGuestUsagePlan",
                name="DDGuestUsagePlan",
                throttle=apigateway.ThrottleSettings(
                rate_limit=10,
                burst_limit=5)
                )
        
        guest_api_key = rest_api.add_api_key("DDGuestApiKey")

        secretsmanager.Secret(self, "GuestApiKeySecret",
                              secret_name="GuestApiKeySecret",
                              description="Stores the Guest API Key Id",
                              secret_string_value=SecretValue.plain_text(guest_api_key.key_id))
        
        guest_usage_plan.add_api_key(guest_api_key)
        
        rest_api.root.add_method("ANY",apigateway.HttpIntegration("https://"+params.domain_name),
                                 authorizer=cognito_auth,
                                 authorization_type=apigateway.AuthorizationType.COGNITO)
         
        space = rest_api.root.add_resource("space")
        space_get=space.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/space"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        list_pins = space.add_resource("list-pins")
        list_pins_get=list_pins.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/space/list-pins"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        space_alias = space.add_resource("alias")
        space_alias_proxy = space_alias.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/space/alias/{proxy}", 
                                                                                            proxy=True,
                                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True}))
                
        space_alias_proxy_get= space_alias_proxy.add_method("GET",
                                                    authorization_type=apigateway.AuthorizationType.IAM)

        brand = rest_api.root.add_resource("brand")
        brand_get=brand.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/brand"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        space_type = rest_api.root.add_resource("space-type")
        space_type_get=space_type.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/space-type"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        venue_type = rest_api.root.add_resource("venue-type")
        venue_type_get=venue_type.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/venue-type"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        venue = rest_api.root.add_resource("venue")
        venue_get=venue.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/venue"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        venue_locations = venue.add_resource("list-locations")
        venue_locations_get=venue_locations.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/venue/list-locations"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        venue_cities = venue.add_resource("list-cities")
        venue_cities_get=venue_cities.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/venue/list-cities"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        auth = rest_api.root.add_resource("auth")
        auth_validate_email = auth.add_resource("validate-email")
        auth_validate_username = auth.add_resource("validate-username")
        auth_validate_phone = auth.add_resource("validate-phone")
        auth_check_exist = auth.add_resource("check-exist")

        auth_validate_email_post = auth_validate_email.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/auth/validate-email", http_method="POST"),
                                       authorization_type=apigateway.AuthorizationType.IAM,
                                       api_key_required=True)
        
        auth_validate_username_post = auth_validate_username.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/auth/validate-username", http_method="POST"),
                                       authorization_type=apigateway.AuthorizationType.IAM,
                                       api_key_required=True)
        
        auth_validate_phone_post = auth_validate_phone.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/auth/validate-phone", http_method="POST"),
                                       authorization_type=apigateway.AuthorizationType.IAM,
                                       api_key_required=True)
        
        auth_check_exist_post = auth_check_exist.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/auth/check-exist", http_method="POST"),
                                       authorization_type=apigateway.AuthorizationType.IAM,
                                       api_key_required=True)
        
        venue_api = rest_api.root.add_resource("venue-api")
        venue_api_proxy = venue_api.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.v2_venue_api_domain+"/{proxy}",
                                                                                            proxy=True,
                                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True}))
        
        venue_api_proxy_get= venue_api_proxy.add_method("GET",
                                                    authorization_type=apigateway.AuthorizationType.IAM)
        
        venue_api_proxy_post= venue_api_proxy.add_method("POST",
                                                    authorization_type=apigateway.AuthorizationType.IAM)

        wp = rest_api.root.add_resource("wp")
        wp_space = wp.add_resource("space")

        wp_space.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/wp/space"),
                                 authorizer=cognito_auth,
                                 authorization_type=apigateway.AuthorizationType.COGNITO)
        
        wp_venue = wp.add_resource("venue")
        wp_venue.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/wp/venue"),
                                 authorizer=cognito_auth,
                                 authorization_type=apigateway.AuthorizationType.COGNITO)
        
        instantly_bookable_conversation = rest_api.root.add_resource("instantlyBookableConversation")
        instantly_bookable_conversation.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/instantlyBookableConversation", http_method="POST"),
                                                authorizer=cognito_auth,
                                                authorization_type=apigateway.AuthorizationType.COGNITO)
        get_booking_request_status = instantly_bookable_conversation.add_resource("getBookingRequestStatus")
        get_booking_request_status.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/instantlyBookableConversation/getBookingRequestStatus"),
                                                authorizer=cognito_auth,
                                                authorization_type=apigateway.AuthorizationType.COGNITO)
        instantly_bookable_conversation.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/instantlyBookableConversation/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))
        
        log = rest_api.root.add_resource("log")
        log_server = log.add_resource("server")
        log_server.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/log/server"),
                              authorizer=cognito_auth,
                              authorization_type=apigateway.AuthorizationType.COGNITO)
        log_server.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/log/server", http_method="POST"),
                              authorizer=cognito_auth,
                              authorization_type=apigateway.AuthorizationType.COGNITO)
        log_email = log.add_resource("email")
        log_email.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/log/email"),
                             authorizer=cognito_auth,
                             authorization_type=apigateway.AuthorizationType.COGNITO)
        log_email.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/log/email", http_method="POST"),
                             authorizer=cognito_auth,
                             authorization_type=apigateway.AuthorizationType.COGNITO)
        log_server.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/log/server/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))

        log_email.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/log/email/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))

        subscription = rest_api.root.add_resource("subscription")

        subscription.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/subscription"),
                                authorizer=cognito_auth,
                                authorization_type=apigateway.AuthorizationType.COGNITO)
        
        subscription.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/subscription", http_method="POST"),
                                authorizer=cognito_auth,
                                authorization_type=apigateway.AuthorizationType.COGNITO)
        
        subscription.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/subscription/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))
        
        brand_default = brand.add_resource("default-brand")
        brand_default.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/brand/default-brand"),
                                 authorizer=cognito_auth,
                                 authorization_type=apigateway.AuthorizationType.COGNITO)
        
        amenity = rest_api.root.add_resource("amenity")
        amenity_get = amenity.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/amenity"),
                           authorization_type=apigateway.AuthorizationType.IAM,
                           api_key_required=True)
        
        amenity_proxy = amenity.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/amenity/{proxy}",
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True}))
                                                                
        amenity_proxy_get= amenity_proxy.add_method("GET",
                                                    authorization_type=apigateway.AuthorizationType.IAM)
        
        top_amenity = amenity.add_resource("top-amenities")
        top_amenity_get = top_amenity.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/amenity/top-amenities"),
                                 authorization_type=apigateway.AuthorizationType.IAM,
                                 api_key_required=True)

        
        venue.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/venue", http_method="POST"),
                         authorizer=cognito_auth,
                         authorization_type=apigateway.AuthorizationType.COGNITO)
        
        venue_provider_data_batch_update = venue.add_resource("provider-data-batch-update")

        venue_provider_data_batch_update.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/venue/provider-data-batch-update", http_method="POST"),
                                                    authorizer=cognito_auth,
                                                    authorization_type=apigateway.AuthorizationType.COGNITO)
        
        venue.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/venue/{proxy}",
                                                                    http_method="ANY",
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))
        
        space_type.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/space-type", http_method="POST"),
                              authorizer=cognito_auth,
                              authorization_type=apigateway.AuthorizationType.COGNITO)
        
        space_type.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/space-type/{proxy}",
                                                                            http_method="ANY", 
                                                                            proxy=True,
                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                             authorizer=cognito_auth,
                                                                                                                             authorization_type=apigateway.AuthorizationType.COGNITO))
                                          
        venue_type.add_method("POST", 
                              apigateway.HttpIntegration("https://"+params.domain_name+"/venue-type", http_method="POST"),
                              authorizer=cognito_auth,
                              authorization_type=apigateway.AuthorizationType.COGNITO)
        
        venue_type.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/venue-type/{proxy}",
                                                                            http_method="ANY", 
                                                                            proxy=True,
                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                             authorizer=cognito_auth,
                                                                                                                             authorization_type=apigateway.AuthorizationType.COGNITO))
        
        space_amenity = rest_api.root.add_resource("space-amenity")
        space_amenity.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/space-amenity"),
                                 authorizer=cognito_auth,
                                 authorization_type=apigateway.AuthorizationType.COGNITO)
        
        space_amenity.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/space-amenity", http_method="POST"),
                                 authorizer=cognito_auth,
                                 authorization_type=apigateway.AuthorizationType.COGNITO)
        
        space_amenity.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/space-amenity/{proxy}",
                                                                            http_method="ANY", 
                                                                            proxy=True,
                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                             authorizer=cognito_auth,
                                                                                                                             authorization_type=apigateway.AuthorizationType.COGNITO))
        
        brand.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/brand", http_method="POST"),
                         authorizer=cognito_auth,
                         authorization_type=apigateway.AuthorizationType.COGNITO)
        
        brand.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/brand/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))
        
        payment_mode = rest_api.root.add_resource("payment-mode")
        payment_mode.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/payment-mode"),
                                authorizer=cognito_auth,
                                authorization_type=apigateway.AuthorizationType.COGNITO)
        
        user = rest_api.root.add_resource("user")
        user_find = user.add_resource("find")
        user_sync_password_entry = user.add_resource("sync-password-entry")
        user_invite = user.add_resource("invite")
        user_validate_import = user.add_resource("validate-import")
        user_import = user.add_resource("import")

        user.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/user"),
                        authorizer=cognito_auth,
                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        user.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/user", http_method="POST"),
                        authorizer=cognito_auth,
                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        user.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/user/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))
        
        user_find.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/v2/user/find"),
                             authorizer=cognito_auth,
                             authorization_type=apigateway.AuthorizationType.COGNITO)
        
        user_sync_password_post = user_sync_password_entry.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/v2/user/sync-password-entry", http_method="POST"),
                                            authorization_type=apigateway.AuthorizationType.IAM)
        
        user_sync_password_get = user_sync_password_entry.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/v2/user/sync-password-entry"),
                                            authorization_type=apigateway.AuthorizationType.IAM)

        user_invite.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/user/invite", http_method="POST"),
                               authorizer=cognito_auth,
                               authorization_type=apigateway.AuthorizationType.COGNITO)
        
        user_validate_import.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/user/validate-import", http_method="POST"),
                                        authorizer=cognito_auth,
                                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        user_import.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/user/import", http_method="POST"),
                               authorizer=cognito_auth,
                               authorization_type=apigateway.AuthorizationType.COGNITO)
        
        feature = rest_api.root.add_resource("feature")
        feature_list = feature.add_resource("list")
        feature_list_get=feature_list.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/feature/list"),
                            authorization_type=apigateway.AuthorizationType.IAM,
                            api_key_required=True)
        
        group = rest_api.root.add_resource("group")
        group.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/group"),
                         authorizer=cognito_auth,
                         authorization_type=apigateway.AuthorizationType.COGNITO)
        
        group.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/group", http_method="POST"),
                         authorizer=cognito_auth,
                         authorization_type=apigateway.AuthorizationType.COGNITO)
        
        group.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/group/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))
        
        invoice_status = rest_api.root.add_resource("invoice-status")
        invoice_status.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/invoice-status"),
                                  authorizer=cognito_auth,
                                  authorization_type=apigateway.AuthorizationType.COGNITO)
        
        security_deposit_status = rest_api.root.add_resource("securityDeposit-status")
        security_deposit_status.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/securityDeposit-status"),
                                           authorizer=cognito_auth,
                                           authorization_type=apigateway.AuthorizationType.COGNITO)
        
        invoice = rest_api.root.add_resource("invoice")
        invoice.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/invoice"),
                           authorizer=cognito_auth,
                           authorization_type=apigateway.AuthorizationType.COGNITO)
        
        invoice.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/invoice", http_method="POST"),
                           authorizer=cognito_auth,
                           authorization_type=apigateway.AuthorizationType.COGNITO)

        invoice.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/invoice/{proxy}",
                                                                         http_method="ANY",
                                                                         proxy=True,
                                                                         options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                         default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                          authorizer=cognito_auth,
                                                                                                                          authorization_type=apigateway.AuthorizationType.COGNITO))
         
        invoice_checkin = invoice.add_resource("check-in")
        invoice_checkin.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/invoice/check-in"),
                                   authorizer=cognito_auth,
                                   authorization_type=apigateway.AuthorizationType.COGNITO)
        
        invoice_charge_hours = invoice.add_resource("charge-hours")
        invoice_charge_hours.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/invoice/charge-hours"),
                                        authorizer=cognito_auth,
                                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        team = rest_api.root.add_resource("team")
        team.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/team"),
                        authorizer=cognito_auth,
                        authorization_type=apigateway.AuthorizationType.COGNITO)

        team.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/team", http_method="POST"),
                        authorizer=cognito_auth,
                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        team.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/team/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))
        
        role = rest_api.root.add_resource("role")
        role.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/role"),
                        authorizer=cognito_auth,
                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        role.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/role", http_method="POST"),
                        authorizer=cognito_auth,
                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        role.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/role/{proxy}",
                                                                    http_method="ANY", 
                                                                    proxy=True,
                                                                    options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                    default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                     authorizer=cognito_auth,
                                                                                                                     authorization_type=apigateway.AuthorizationType.COGNITO))      
        user_permissions = rest_api.root.add_resource("user-permissions")
        user_permissions.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/user-permissions"),
                                        authorizer=cognito_auth,
                                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        brand_category = rest_api.root.add_resource("brand-category")
        brand_category.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/brand-category", http_method="POST"),
                                    authorizer=cognito_auth,
                                    authorization_type=apigateway.AuthorizationType.COGNITO)
    
        brand_category.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/brand-category/{proxy}",
                                                                            http_method="ANY",
                                                                            proxy=True,
                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                             authorizer=cognito_auth,
                                                                                                                             authorization_type=apigateway.AuthorizationType.COGNITO))
        brand_category_all = brand_category.add_resource("all")
        brand_category_all_get = brand_category_all.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/brand-category/all"),
                                    authorization_type=apigateway.AuthorizationType.IAM,
                                    api_key_required=True)
        
        brand_sub_category = rest_api.root.add_resource("brand-sub-category")
        brand_sub_category_proxy = brand_sub_category.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/brand-sub-category/{proxy}",
                                                                            proxy=True,
                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True}))
        
        brand_sub_category_proxy_get= brand_sub_category_proxy.add_method("GET",
                                                    authorization_type=apigateway.AuthorizationType.IAM)
        
        brand_sub_category_all = brand_sub_category.add_resource("all")
        brand_sub_category_all_get = brand_sub_category_all.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/brand-sub-category/all"),
                                      authorization_type=apigateway.AuthorizationType.IAM,
                                      api_key_required=True)

        conversation = rest_api.root.add_resource("conversation")
        conversation.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/conversation", http_method="POST"),
                                authorizer=cognito_auth,
                                authorization_type=apigateway.AuthorizationType.COGNITO)
        
        conversation.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/conversation/{proxy}",
                                                                            http_method="ANY", 
                                                                            proxy=True,
                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                             authorizer=cognito_auth,
                                                                                                                             authorization_type=apigateway.AuthorizationType.COGNITO))
        
        company = rest_api.root.add_resource("company")
        company.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/company"),
                           authorizer=cognito_auth,
                           authorization_type=apigateway.AuthorizationType.COGNITO)
        
        company.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/company", http_method="POST"),
                           authorizer=cognito_auth,
                           authorization_type=apigateway.AuthorizationType.COGNITO)
        
        company.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/company/{proxy}",
                                                                        http_method="ANY", 
                                                                        proxy=True,
                                                                        options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                        default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                         authorizer=cognito_auth,
                                                                                                                         authorization_type=apigateway.AuthorizationType.COGNITO))
        
        email_template = rest_api.root.add_resource("email-template")
        email_template.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/email-template"),
                                  authorizer=cognito_auth,
                                  authorization_type=apigateway.AuthorizationType.COGNITO)
        
        email_template.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/email-template", http_method="POST"),
                                  authorizer=cognito_auth,
                                  authorization_type=apigateway.AuthorizationType.COGNITO)
        
        email_template.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/email-template/{proxy}",
                                                                                http_method="ANY", 
                                                                                proxy=True,
                                                                                options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                                default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                                 authorizer=cognito_auth,
                                                                                                                                 authorization_type=apigateway.AuthorizationType.COGNITO))
                
        email_template_type = rest_api.root.add_resource("email-template-type")
        email_template_type.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/email-template-type"),
                                       authorizer=cognito_auth,
                                       authorization_type=apigateway.AuthorizationType.COGNITO)
        
        email_template_type.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/email-template-type", http_method="POST"),
                                       authorizer=cognito_auth,
                                       authorization_type=apigateway.AuthorizationType.COGNITO)
        
        email_template_type.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/email-template-type/{proxy}", 
                                                                                     http_method="ANY",
                                                                                     proxy=True,
                                                                                     options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                                     default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                                      authorizer=cognito_auth,
                                                                                                                                      authorization_type=apigateway.AuthorizationType.COGNITO))
        
        email_variable = rest_api.root.add_resource("email-variable")
        email_variable.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/email-variable"),
                                  authorizer=cognito_auth,
                                  authorization_type=apigateway.AuthorizationType.COGNITO)        
        
        email_variable.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/email-variable", http_method="POST"),
                                  authorizer=cognito_auth,
                                  authorization_type=apigateway.AuthorizationType.COGNITO)
        
        email_variable.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/email-variable/{proxy}",
                                                                                http_method="ANY", 
                                                                                proxy=True,
                                                                                options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                                default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                                 authorizer=cognito_auth,
                                                                                                                                 authorization_type=apigateway.AuthorizationType.COGNITO))
        
        feed = rest_api.root.add_resource("feed")

        feed.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/feed"),
                        authorizer=cognito_auth,
                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        feed.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/feed", http_method="POST"),
                        authorizer=cognito_auth,
                        authorization_type=apigateway.AuthorizationType.COGNITO)
        
        feed.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/feed/{proxy}",
                                                                      http_method="ANY", 
                                                                      proxy=True,
                                                                      options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                      default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                       authorizer=cognito_auth,
                                                                                                                       authorization_type=apigateway.AuthorizationType.COGNITO))
    
        feed_category = rest_api.root.add_resource("feed-category")

        feed_category.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/feed-category"),
                                 authorizer=cognito_auth,
                                 authorization_type=apigateway.AuthorizationType.COGNITO)
        
        feed_category.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/feed-category", http_method="POST"),
                                 authorizer=cognito_auth,
                                 authorization_type=apigateway.AuthorizationType.COGNITO)
        
        feed_category.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/feed-category/{proxy}",
                                                                            http_method="ANY",
                                                                            proxy=True,
                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                             authorizer=cognito_auth,
                                                                                                                             authorization_type=apigateway.AuthorizationType.COGNITO))
        
        reservation = rest_api.root.add_resource("reservation")

        reservation.add_method("GET", apigateway.HttpIntegration("https://"+params.domain_name+"/reservation"),
                                authorizer=cognito_auth,
                                authorization_type=apigateway.AuthorizationType.COGNITO)
        
        reservation.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/reservation", http_method="POST"),
                                authorizer=cognito_auth,
                                authorization_type=apigateway.AuthorizationType.COGNITO)
        
        reservation.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/reservation/{proxy}",
                                                                            http_method="ANY", 
                                                                            proxy=True,
                                                                            options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                            default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                             authorizer=cognito_auth,
                                                                                                                             authorization_type=apigateway.AuthorizationType.COGNITO))
        space.add_method("POST", apigateway.HttpIntegration("https://"+params.domain_name+"/space", http_method="POST"), 
                         authorizer=cognito_auth,
                         authorization_type=apigateway.AuthorizationType.COGNITO)
        
        space.add_proxy(default_integration=apigateway.HttpIntegration("https://"+params.domain_name+"/space/{proxy}", 
                                                                       http_method="ANY",
                                                                       proxy=True,
                                                                       options=apigateway.IntegrationOptions( request_parameters={'integration.request.path.proxy': 'method.request.path.proxy'} )),
                                                                       default_method_options= apigateway.MethodOptions(request_parameters={"method.request.path.proxy":True},
                                                                                                                        authorizer=cognito_auth,
                                                                                                                        authorization_type=apigateway.AuthorizationType.COGNITO))
        
        guest_usage_plan.add_api_stage(stage=rest_api.deployment_stage,
                                 throttle=[
                                     apigateway.ThrottlingPerMethod(
                                     method=list_pins_get,
                                     throttle=apigateway.ThrottleSettings(
                                     rate_limit=10,
                                     burst_limit=5)
                                    ),
                                    apigateway.ThrottlingPerMethod(
                                    method=space_get,
                                    throttle=apigateway.ThrottleSettings(
                                    rate_limit=10,
                                    burst_limit=5)
                                    ),
                                    apigateway.ThrottlingPerMethod(
                                    method=brand_get,
                                    throttle=apigateway.ThrottleSettings(
                                    rate_limit=10,
                                    burst_limit=5)
                                    ),
                                    apigateway.ThrottlingPerMethod(
                                    method=space_type_get,
                                    throttle=apigateway.ThrottleSettings(
                                    rate_limit=10,
                                    burst_limit=5)
                                    ),
                                    apigateway.ThrottlingPerMethod(
                                    method=venue_get,
                                    throttle=apigateway.ThrottleSettings(
                                    rate_limit=10,
                                    burst_limit=5)
                                    ),
                                    apigateway.ThrottlingPerMethod(
                                    method=venue_type_get,
                                    throttle=apigateway.ThrottleSettings(
                                    rate_limit=10,
                                    burst_limit=5)
                                    ),
                                    apigateway.ThrottlingPerMethod(
                                        method=venue_locations_get,
                                        throttle=apigateway.ThrottleSettings(
                                        rate_limit=10,
                                        burst_limit=5)
                                    ),
                                    apigateway.ThrottlingPerMethod(
                                        method=venue_cities_get,
                                        throttle=apigateway.ThrottleSettings(
                                        rate_limit=10,
                                        burst_limit=5)
                                    ),
                                    apigateway.ThrottlingPerMethod(
                                        method=brand_category_all_get,
                                        throttle=apigateway.ThrottleSettings(
                                        rate_limit=10,
                                        burst_limit=5)
                                    ),
                                 ])
                
        route53.ARecord(self, "v2-a-record",
                        record_name=params.v2_domain_name,
                        zone=route53.HostedZone.from_hosted_zone_attributes(self, 
                                                                            "dd-hosted-zone", 
                                                                            hosted_zone_id=params.hosted_zone_id,
                                                                            zone_name=params.zone_name),
                        target=route53.RecordTarget.from_alias(targets.ApiGatewayDomain(api_custom_domain)))
        
        identity_pool = cognito_identitypool.IdentityPool(self, "cognito-identity-pool",
                                                          allow_unauthenticated_identities=True,
                                                          )
        secretsmanager.Secret(self, "IdentityPoolIdSecret",
                              secret_name="IdentityPoolIdSecret",
                              description="Stores the Identity Pool ID",
                              secret_string_value=SecretValue.plain_text(identity_pool.identity_pool_id))
        
        guest_policy_statement_1 = iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["cognito-identity:GetCredentialsForIdentity"],
            resources=["*"]
        )

        guest_policy_statement_2 = iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["execute-api:Invoke"],
            resources=[space_get.method_arn,
                       brand_get.method_arn,
                       space_type_get.method_arn,
                       venue_get.method_arn,
                       venue_type_get.method_arn,
                       list_pins_get.method_arn,
                       space_alias_proxy_get.method_arn,
                       venue_locations_get.method_arn,
                       venue_cities_get.method_arn,
                       brand_category_all_get.method_arn,
                       brand_sub_category_all_get.method_arn,
                       brand_sub_category_proxy_get.method_arn,
                       venue_api_proxy_get.method_arn,
                       venue_api_proxy_post.method_arn,
                       feature_list_get.method_arn,
                       top_amenity_get.method_arn,
                       amenity_get.method_arn,
                       amenity_proxy_get.method_arn,
                       auth_validate_email_post.method_arn,
                       auth_validate_username_post.method_arn,
                       auth_validate_phone_post.method_arn,
                       auth_check_exist_post.method_arn,
                       user_sync_password_post.method_arn,
                       user_sync_password_get.method_arn,
                       ]
        )

        identity_pool.unauthenticated_role.add_to_principal_policy(guest_policy_statement_1)
        identity_pool.unauthenticated_role.add_to_principal_policy(guest_policy_statement_2)

        auth_policy_statement_1 = iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["cognito-identity:GetCredentialsForIdentity"],
            resources=["*"]
        )

        auth_policy_statement_2 = iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["execute-api:Invoke"],
            resources=[feature_list_get.method_arn])
        
        identity_pool.authenticated_role.add_to_principal_policy(auth_policy_statement_1)
        identity_pool.authenticated_role.add_to_principal_policy(auth_policy_statement_2)

        identity_pool.add_user_pool_authentication(UserPoolAuthenticationProvider(user_pool=user_pool,
                                                                                  user_pool_client=user_pool_client,
                                                                                  disable_server_side_token_check=True))
        
        identity_pool.add_user_pool_authentication(UserPoolAuthenticationProvider(user_pool=admin_pool,
                                                                                  user_pool_client=admin_pool_client,
                                                                                  disable_server_side_token_check=True))
