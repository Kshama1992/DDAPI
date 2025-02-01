class DropdeskDeploymentParams:
    def __init__(self,
                 domain_name,
                 hosted_zone_id,
                 zone_name,
                 availability_zones=3,
                 build_args=None,
                 cpu=2048,
                 memory_in_gb=8,
                 cpu_target_utilization=50,
                 cpu_scale_in_cooldown=60,
                 cpu_scale_out_cooldown=15,
                 mem_target_utilization=50,
                 mem_scale_in_cooldown=60,
                 mem_scale_out_cooldown=15,
                 min_capacity=2,
                 max_capacity=4,
                 fargate_spot_ratio=1,
                 fargate_ratio=1,
                 cookie_domain='.drop-desk.com',
                 v2_domain_name=' ',
                 v2_venue_api_domain=' ',
                 domain_certificate=' ',
                 auth_client_domain=' ',
                 auth_admin_client_domain=' ',
                 allow_origin=' ',
                 deregistration_delay=None,
                 ):
        self.domain_name = domain_name
        self.hosted_zone_id = hosted_zone_id
        self.zone_name = zone_name
        self.availability_zones = availability_zones
        self.build_args = build_args
        self.cpu = cpu
        self.memory_in_gb = memory_in_gb
        self.cpu_target_utilization = cpu_target_utilization
        self.cpu_scale_in_cooldown = cpu_scale_in_cooldown
        self.cpu_scale_out_cooldown = cpu_scale_out_cooldown
        self.mem_target_utilization = mem_target_utilization
        self.mem_scale_in_cooldown = mem_scale_in_cooldown
        self.mem_scale_out_cooldown = mem_scale_out_cooldown
        self.min_capacity = min_capacity
        self.max_capacity = max_capacity
        self.cookie_domain = cookie_domain
        self.fargate_spot_ratio = fargate_spot_ratio
        self.fargate_ratio = fargate_ratio
        self.v2_domain_name = v2_domain_name
        self.v2_venue_api_domain = v2_venue_api_domain
        self.domain_certificate = domain_certificate
        self.auth_client_domain = auth_client_domain
        self.auth_admin_client_domain = auth_admin_client_domain
        self.allow_origin = allow_origin
        self.deregistration_delay = deregistration_delay

