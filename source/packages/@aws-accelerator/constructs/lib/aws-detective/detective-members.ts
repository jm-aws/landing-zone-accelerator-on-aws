/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { CUSTOM_RESOURCE_PROVIDER_RUNTIME } from '@aws-accelerator/utils/lib/lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

const path = require('path');

/**
 * Initialized DetectiveMembersProps properties
 */
export interface DetectiveMembersProps {
  /**
   * Custom resource lambda log group encryption key, when undefined default AWS managed key will be used
   */
  readonly kmsKey?: cdk.aws_kms.IKey;
  /**
   * Custom resource lambda log retention in days
   */
  readonly logRetentionInDays: number;
}

/**
 /**
 * Class to Detective Members
 */
export class DetectiveMembers extends Construct {
  public readonly id: string;

  constructor(scope: Construct, id: string, props: DetectiveMembersProps) {
    super(scope, id);

    const RESOURCE_TYPE = 'Custom::DetectiveCreateMembers';

    const provider = cdk.CustomResourceProvider.getOrCreateProvider(this, RESOURCE_TYPE, {
      codeDirectory: path.join(__dirname, 'create-members/dist'),
      runtime: CUSTOM_RESOURCE_PROVIDER_RUNTIME,
      policyStatements: [
        {
          Sid: 'DetectiveCreateMembersTaskDetectiveActions',
          Effect: 'Allow',
          Action: [
            'detective:ListOrganizationAdminAccounts',
            'detective:UpdateOrganizationConfiguration',
            'detective:CreateMembers',
            'detective:DeleteMembers',
            'detective:DisassociateMembership',
            'detective:ListMembers',
            'detective:ListGraphs',
          ],
          Resource: '*',
        },
        {
          Sid: 'ServiceLinkedRoleDetective',
          Effect: 'Allow',
          Action: ['iam:CreateServiceLinkedRole'],
          Resource: ['*'],
        },
        {
          Sid: 'OrganisationsListDetective',
          Effect: 'Allow',
          Action: ['organizations:ListAccounts'],
          Resource: ['*'],
        },
      ],
    });

    const resource = new cdk.CustomResource(this, 'Resource', {
      resourceType: RESOURCE_TYPE,
      serviceToken: provider.serviceToken,
      properties: {
        region: cdk.Stack.of(this).region,
        partition: cdk.Aws.PARTITION,
      },
    });

    /**
     * Singleton pattern to define the log group for the singleton function
     * in the stack
     */
    const stack = cdk.Stack.of(scope);
    const logGroup =
      (stack.node.tryFindChild(`${provider.node.id}LogGroup`) as cdk.aws_logs.LogGroup) ??
      new cdk.aws_logs.LogGroup(stack, `${provider.node.id}LogGroup`, {
        logGroupName: `/aws/lambda/${(provider.node.findChild('Handler') as cdk.aws_lambda.CfnFunction).ref}`,
        retention: props.logRetentionInDays,
        encryptionKey: props.kmsKey,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });
    resource.node.addDependency(logGroup);

    this.id = resource.ref;
  }
}
