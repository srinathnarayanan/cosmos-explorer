import * as ko from "knockout";
import * as Constants from "../../Common/Constants";
import { createDatabase } from "../../Common/dataAccess/createDatabase";
import editable from "../../Common/EditableUtility";
import { getErrorMessage, getErrorStack } from "../../Common/ErrorHandlingUtils";
import { configContext, Platform } from "../../ConfigContext";
import * as DataModels from "../../Contracts/DataModels";
import { SubscriptionType } from "../../Contracts/SubscriptionType";
import * as ViewModels from "../../Contracts/ViewModels";
import * as SharedConstants from "../../Shared/Constants";
import { Action, ActionModifiers } from "../../Shared/Telemetry/TelemetryConstants";
import * as TelemetryProcessor from "../../Shared/Telemetry/TelemetryProcessor";
import { userContext } from "../../UserContext";
import * as AutoPilotUtils from "../../Utils/AutoPilotUtils";
import * as PricingUtils from "../../Utils/PricingUtils";
import { ContextualPaneBase } from "./ContextualPaneBase";

export default class AddDatabasePane extends ContextualPaneBase {
  public defaultExperience: ko.Computed<string>;
  public databaseIdLabel: ko.Computed<string>;
  public databaseIdPlaceHolder: ko.Computed<string>;
  public databaseId: ko.Observable<string>;
  public databaseIdTooltipText: ko.Computed<string>;
  public databaseLevelThroughputTooltipText: ko.Computed<string>;
  public databaseCreateNewShared: ko.Observable<boolean>;
  public formErrorsDetails: ko.Observable<string>;
  public throughput: ViewModels.Editable<number>;
  public maxThroughputRU: ko.Observable<number>;
  public minThroughputRU: ko.Observable<number>;
  public maxThroughputRUText: ko.PureComputed<string>;
  public throughputRangeText: ko.Computed<string>;
  public throughputSpendAckText: ko.Observable<string>;
  public throughputSpendAck: ko.Observable<boolean>;
  public throughputSpendAckVisible: ko.Computed<boolean>;
  public requestUnitsUsageCost: ko.Computed<string>;
  public canRequestSupport: ko.PureComputed<boolean>;
  public costsVisible: ko.PureComputed<boolean>;
  public upsellMessage: ko.PureComputed<string>;
  public upsellMessageAriaLabel: ko.PureComputed<string>;
  public upsellAnchorUrl: ko.PureComputed<string>;
  public upsellAnchorText: ko.PureComputed<string>;
  public isAutoPilotSelected: ko.Observable<boolean>;
  public maxAutoPilotThroughputSet: ko.Observable<number>;
  public autoPilotUsageCost: ko.Computed<string>;
  public canExceedMaximumValue: ko.PureComputed<boolean>;
  public ruToolTipText: ko.Computed<string>;
  public freeTierExceedThroughputTooltip: ko.Computed<string>;
  public isFreeTierAccount: ko.Computed<boolean>;
  public canConfigureThroughput: ko.PureComputed<boolean>;
  public showUpsellMessage: ko.PureComputed<boolean>;

  constructor(options: ViewModels.PaneOptions) {
    super(options);
    this.title((this.container && this.container.addDatabaseText()) || "New Database");
    this.databaseId = ko.observable<string>();
    this.ruToolTipText = ko.pureComputed(() => PricingUtils.getRuToolTipText());
    this.canConfigureThroughput = ko.pureComputed(() => !this.container.isServerlessEnabled());

    this.canExceedMaximumValue = ko.pureComputed(() => this.container.canExceedMaximumValue());

    // TODO 388844: get defaults from parent frame
    this.databaseCreateNewShared = ko.observable<boolean>(this.getSharedThroughputDefault());

    this.databaseIdLabel = ko.computed<string>(() =>
      userContext.apiType === "Cassandra" ? "Keyspace id" : "Database id"
    );

    this.databaseIdPlaceHolder = ko.computed<string>(() =>
      userContext.apiType === "Cassandra" ? "Type a new keyspace id" : "Type a new database id"
    );

    this.databaseIdTooltipText = ko.computed<string>(() => {
      const isCassandraAccount: boolean = userContext.apiType === "Cassandra";
      return `A ${isCassandraAccount ? "keyspace" : "database"} is a logical container of one or more ${
        isCassandraAccount ? "tables" : "collections"
      }`;
    });
    this.databaseLevelThroughputTooltipText = ko.computed<string>(() => {
      const isCassandraAccount: boolean = userContext.apiType === "Cassandra";
      const databaseLabel: string = isCassandraAccount ? "keyspace" : "database";
      const collectionsLabel: string = isCassandraAccount ? "tables" : "collections";
      return `Provisioned throughput at the ${databaseLabel} level will be shared across all ${collectionsLabel} within the ${databaseLabel}.`;
    });

    this.throughput = editable.observable<number>();
    this.maxThroughputRU = ko.observable<number>();
    this.minThroughputRU = ko.observable<number>();
    this.throughputSpendAckText = ko.observable<string>();
    this.throughputSpendAck = ko.observable<boolean>(false);
    this.isAutoPilotSelected = ko.observable<boolean>(false);
    this.maxAutoPilotThroughputSet = ko.observable<number>(AutoPilotUtils.minAutoPilotThroughput);
    this.autoPilotUsageCost = ko.pureComputed<string>(() => {
      const autoPilot = this._isAutoPilotSelectedAndWhatTier();
      if (!autoPilot) {
        return "";
      }
      return PricingUtils.getAutoPilotV3SpendHtml(autoPilot.maxThroughput, true /* isDatabaseThroughput */);
    });
    this.throughputRangeText = ko.pureComputed<string>(() => {
      if (this.isAutoPilotSelected()) {
        return AutoPilotUtils.getAutoPilotHeaderText();
      }
      return `Throughput (${this.minThroughputRU().toLocaleString()} - ${this.maxThroughputRU().toLocaleString()} RU/s)`;
    });

    this.requestUnitsUsageCost = ko.computed(() => {
      const offerThroughput: number = this.throughput();
      if (
        offerThroughput < this.minThroughputRU() ||
        (offerThroughput > this.maxThroughputRU() && !this.canExceedMaximumValue())
      ) {
        return "";
      }

      const { databaseAccount: account } = userContext;
      if (!account) {
        return "";
      }

      const regions = account?.properties?.readLocations?.length || 1;
      const multimaster = account?.properties?.enableMultipleWriteLocations || false;

      let estimatedSpendAcknowledge: string;
      let estimatedSpend: string;
      if (!this.isAutoPilotSelected()) {
        estimatedSpend = PricingUtils.getEstimatedSpendHtml(
          offerThroughput,
          userContext.portalEnv,
          regions,
          multimaster
        );
        estimatedSpendAcknowledge = PricingUtils.getEstimatedSpendAcknowledgeString(
          offerThroughput,
          userContext.portalEnv,
          regions,
          multimaster,
          this.isAutoPilotSelected()
        );
      } else {
        estimatedSpend = PricingUtils.getEstimatedAutoscaleSpendHtml(
          this.maxAutoPilotThroughputSet(),
          userContext.portalEnv,
          regions,
          multimaster
        );
        estimatedSpendAcknowledge = PricingUtils.getEstimatedSpendAcknowledgeString(
          this.maxAutoPilotThroughputSet(),
          userContext.portalEnv,
          regions,
          multimaster,
          this.isAutoPilotSelected()
        );
      }
      // TODO: change throughputSpendAckText to be a computed value, instead of having this side effect
      this.throughputSpendAckText(estimatedSpendAcknowledge);
      return estimatedSpend;
    });

    this.canRequestSupport = ko.pureComputed(() => {
      if (
        configContext.platform !== Platform.Emulator &&
        !userContext.isTryCosmosDBSubscription &&
        configContext.platform !== Platform.Portal
      ) {
        const offerThroughput: number = this.throughput();
        return offerThroughput <= 100000;
      }

      return false;
    });

    this.isFreeTierAccount = ko.computed<boolean>(() => {
      return userContext?.databaseAccount?.properties?.enableFreeTier;
    });

    this.showUpsellMessage = ko.pureComputed(() => {
      if (this.container.isServerlessEnabled()) {
        return false;
      }

      if (this.isFreeTierAccount()) {
        return this.databaseCreateNewShared();
      }

      return true;
    });

    this.maxThroughputRUText = ko.pureComputed(() => {
      return this.maxThroughputRU().toLocaleString();
    });

    this.costsVisible = ko.pureComputed(() => {
      return configContext.platform !== Platform.Emulator;
    });

    this.throughputSpendAckVisible = ko.pureComputed<boolean>(() => {
      const autoscaleThroughput = this.maxAutoPilotThroughputSet() * 1;
      if (this.isAutoPilotSelected()) {
        return autoscaleThroughput > SharedConstants.CollectionCreation.DefaultCollectionRUs100K;
      }

      const selectedThroughput: number = this.throughput();
      const maxRU: number = this.maxThroughputRU && this.maxThroughputRU();

      const isMaxRUGreaterThanDefault: boolean = maxRU > SharedConstants.CollectionCreation.DefaultCollectionRUs100K;
      const isThroughputSetGreaterThanDefault: boolean =
        selectedThroughput > SharedConstants.CollectionCreation.DefaultCollectionRUs100K;

      if (this.canExceedMaximumValue()) {
        return isThroughputSetGreaterThanDefault;
      }

      return isThroughputSetGreaterThanDefault && isMaxRUGreaterThanDefault;
    });

    this.databaseCreateNewShared.subscribe((useShared: boolean) => {
      this._updateThroughputLimitByDatabase();
    });

    this.resetData();

    this.freeTierExceedThroughputTooltip = ko.pureComputed<string>(() =>
      this.isFreeTierAccount() && !this.container.isFirstResourceCreated()
        ? "The first 400 RU/s in this account are free. Billing will apply to any throughput beyond 400 RU/s."
        : ""
    );

    this.upsellMessage = ko.pureComputed<string>(() => {
      return PricingUtils.getUpsellMessage(
        userContext.portalEnv,
        this.isFreeTierAccount(),
        this.container.isFirstResourceCreated(),
        false
      );
    });

    this.upsellMessageAriaLabel = ko.pureComputed<string>(() => {
      return `${this.upsellMessage()}. Click ${this.isFreeTierAccount() ? "to learn more" : "for more details"}`;
    });

    this.upsellAnchorUrl = ko.pureComputed<string>(() => {
      return this.isFreeTierAccount() ? Constants.Urls.freeTierInformation : Constants.Urls.cosmosPricing;
    });

    this.upsellAnchorText = ko.pureComputed<string>(() => {
      return this.isFreeTierAccount() ? "Learn more" : "More details";
    });
  }

  public onMoreDetailsKeyPress = (source: any, event: KeyboardEvent): boolean => {
    if (event.keyCode === Constants.KeyCodes.Space || event.keyCode === Constants.KeyCodes.Enter) {
      this.showErrorDetails();
      return false;
    }
    return true;
  };

  public open() {
    super.open();
    this.resetData();
    const addDatabasePaneOpenMessage = {
      subscriptionType: userContext.subscriptionType,
      subscriptionQuotaId: userContext.quotaId,
      defaultsCheck: {
        throughput: this.throughput(),
        flight: userContext.addCollectionFlight,
      },
      dataExplorerArea: Constants.Areas.ContextualPane,
    };
    const focusElement = document.getElementById("database-id");
    focusElement && focusElement.focus();
    TelemetryProcessor.trace(Action.CreateDatabase, ActionModifiers.Open, addDatabasePaneOpenMessage);
  }

  public submit() {
    if (!this._isValid()) {
      return;
    }

    const offerThroughput: number = this._computeOfferThroughput();

    const addDatabasePaneStartMessage = {
      database: ko.toJS({
        id: this.databaseId(),
        shared: this.databaseCreateNewShared(),
      }),
      offerThroughput,
      subscriptionType: userContext.subscriptionType,
      subscriptionQuotaId: userContext.quotaId,
      defaultsCheck: {
        flight: userContext.addCollectionFlight,
      },
      dataExplorerArea: Constants.Areas.ContextualPane,
    };
    const startKey: number = TelemetryProcessor.traceStart(Action.CreateDatabase, addDatabasePaneStartMessage);
    this.formErrors("");
    this.isExecuting(true);

    const createDatabaseParams: DataModels.CreateDatabaseParams = {
      databaseId: addDatabasePaneStartMessage.database.id,
      databaseLevelThroughput: addDatabasePaneStartMessage.database.shared,
    };

    if (this.isAutoPilotSelected()) {
      createDatabaseParams.autoPilotMaxThroughput = this.maxAutoPilotThroughputSet();
    } else {
      createDatabaseParams.offerThroughput = addDatabasePaneStartMessage.offerThroughput;
    }

    createDatabase(createDatabaseParams).then(
      (database: DataModels.Database) => {
        this._onCreateDatabaseSuccess(offerThroughput, startKey);
      },
      (error: any) => {
        this._onCreateDatabaseFailure(error, offerThroughput, startKey);
      }
    );
  }

  public resetData() {
    this.databaseId("");
    this.databaseCreateNewShared(this.getSharedThroughputDefault());
    this.isAutoPilotSelected(this.container.isAutoscaleDefaultEnabled());
    this.maxAutoPilotThroughputSet(AutoPilotUtils.minAutoPilotThroughput);
    this._updateThroughputLimitByDatabase();
    this.throughputSpendAck(false);
    super.resetData();
  }

  public getSharedThroughputDefault(): boolean {
    const { subscriptionType } = userContext;

    if (subscriptionType === SubscriptionType.EA || this.container.isServerlessEnabled()) {
      return false;
    }

    return true;
  }

  private _onCreateDatabaseSuccess(offerThroughput: number, startKey: number): void {
    this.isExecuting(false);
    this.close();
    this.container.refreshAllDatabases();
    const addDatabasePaneSuccessMessage = {
      database: ko.toJS({
        id: this.databaseId(),
        shared: this.databaseCreateNewShared(),
      }),
      offerThroughput: offerThroughput,
      subscriptionType: userContext.subscriptionType,
      subscriptionQuotaId: userContext.quotaId,
      defaultsCheck: {
        flight: userContext.addCollectionFlight,
      },
      dataExplorerArea: Constants.Areas.ContextualPane,
    };
    TelemetryProcessor.traceSuccess(Action.CreateDatabase, addDatabasePaneSuccessMessage, startKey);
    this.resetData();
  }

  private _onCreateDatabaseFailure(error: any, offerThroughput: number, startKey: number): void {
    this.isExecuting(false);
    const errorMessage = getErrorMessage(error);
    this.formErrors(errorMessage);
    this.formErrorsDetails(errorMessage);
    const addDatabasePaneFailedMessage = {
      database: ko.toJS({
        id: this.databaseId(),
        shared: this.databaseCreateNewShared(),
      }),
      offerThroughput: offerThroughput,
      subscriptionType: userContext.subscriptionType,
      subscriptionQuotaId: userContext.quotaId,
      defaultsCheck: {
        flight: userContext.addCollectionFlight,
      },
      dataExplorerArea: Constants.Areas.ContextualPane,
      error: errorMessage,
      errorStack: getErrorStack(error),
    };
    TelemetryProcessor.traceFailure(Action.CreateDatabase, addDatabasePaneFailedMessage, startKey);
  }

  private _getThroughput(): number {
    const throughput: number = this.throughput();
    return isNaN(throughput) ? 0 : Number(throughput);
  }

  private _computeOfferThroughput(): number {
    if (!this.canConfigureThroughput()) {
      return undefined;
    }

    if (this.isAutoPilotSelected()) {
      return undefined;
    }

    return this._getThroughput();
  }

  private _isValid(): boolean {
    // TODO add feature flag that disables validation for customers with custom accounts
    if (this.isAutoPilotSelected()) {
      const autoPilot = this._isAutoPilotSelectedAndWhatTier();
      if (
        !autoPilot ||
        !autoPilot.maxThroughput ||
        !AutoPilotUtils.isValidAutoPilotThroughput(autoPilot.maxThroughput)
      ) {
        this.formErrors(
          `Please enter a value greater than ${AutoPilotUtils.minAutoPilotThroughput} for autopilot throughput`
        );
        return false;
      }
    }
    const throughput = this._getThroughput();

    if (throughput > SharedConstants.CollectionCreation.DefaultCollectionRUs100K && !this.throughputSpendAck()) {
      this.formErrors(`Please acknowledge the estimated daily spend.`);
      return false;
    }

    const autoscaleThroughput = this.maxAutoPilotThroughputSet() * 1;

    if (
      this.isAutoPilotSelected() &&
      autoscaleThroughput > SharedConstants.CollectionCreation.DefaultCollectionRUs100K &&
      !this.throughputSpendAck()
    ) {
      this.formErrors(`Please acknowledge the estimated monthly spend.`);
      return false;
    }

    return true;
  }

  private _isAutoPilotSelectedAndWhatTier(): DataModels.AutoPilotCreationSettings {
    if (this.isAutoPilotSelected() && this.maxAutoPilotThroughputSet()) {
      return {
        maxThroughput: this.maxAutoPilotThroughputSet() * 1,
      };
    }
    return undefined;
  }

  private _updateThroughputLimitByDatabase() {
    const throughputDefaults = this.container.collectionCreationDefaults.throughput;
    this.throughput(throughputDefaults.shared);
    this.maxThroughputRU(throughputDefaults.unlimitedmax);
    this.minThroughputRU(throughputDefaults.unlimitedmin);
  }
}
