import { TriggerDefinition } from "@azure/cosmos";
import { AuthType } from "../../AuthType";
import { userContext } from "../../UserContext";
import { createUpdateSqlTrigger, getSqlTrigger } from "../../Utils/arm/generatedClients/2020-04-01/sqlResources";
import {
  SqlTriggerCreateUpdateParameters,
  SqlTriggerResource,
} from "../../Utils/arm/generatedClients/2020-04-01/types";
import { logConsoleProgress } from "../../Utils/NotificationConsoleUtils";
import { client } from "../CosmosClient";
import { handleError } from "../ErrorHandlingUtils";

export async function updateTrigger(
  databaseId: string,
  collectionId: string,
  trigger: TriggerDefinition
): Promise<TriggerDefinition> {
  const clearMessage = logConsoleProgress(`Updating trigger ${trigger.id}`);
  const { authType, useSDKOperations, apiType, subscriptionId, resourceGroup, databaseAccount } = userContext;
  try {
    if (authType === AuthType.AAD && !useSDKOperations && apiType === "SQL") {
      const getResponse = await getSqlTrigger(
        subscriptionId,
        resourceGroup,
        databaseAccount.name,
        databaseId,
        collectionId,
        trigger.id
      );

      if (getResponse?.properties?.resource) {
        const createTriggerParams: SqlTriggerCreateUpdateParameters = {
          properties: {
            resource: trigger as SqlTriggerResource,
            options: {},
          },
        };
        const rpResponse = await createUpdateSqlTrigger(
          subscriptionId,
          resourceGroup,
          databaseAccount.name,
          databaseId,
          collectionId,
          trigger.id,
          createTriggerParams
        );
        return rpResponse && (rpResponse.properties?.resource as TriggerDefinition);
      }

      throw new Error(`Failed to update trigger: ${trigger.id} does not exist.`);
    }

    const response = await client()
      .database(databaseId)
      .container(collectionId)
      .scripts.trigger(trigger.id)
      .replace(trigger);
    return response?.resource;
  } catch (error) {
    handleError(error, "UpdateTrigger", `Error while updating trigger ${trigger.id}`);
    throw error;
  } finally {
    clearMessage();
  }
}
