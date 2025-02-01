#!/usr/bin/env python3
import os

import aws_cdk as cdk

from dropdesk_infra.dropdesk_infra_stack import DropdeskInfraStack
from dropdesk_infra.dropdesk_pipeline_stack import DropdeskPipelineStack

app = cdk.App()

DropdeskPipelineStack(app, 'DropdeskPipelineStack', env = cdk.Environment(account='267382717105', region='us-east-1'))

app.synth()
