import * as ko from "knockout";
import React from "react";
import NewVertexIcon from "../../../images/NewVertex.svg";
import StyleIcon from "../../../images/Style.svg";
import { DatabaseAccount } from "../../Contracts/DataModels";
import * as ViewModels from "../../Contracts/ViewModels";
import { CommandButtonComponentProps } from "../Controls/CommandButton/CommandButtonComponent";
import {
  GraphAccessor,
  GraphExplorer,
  GraphExplorerError,
  GraphExplorerProps,
} from "../Graph/GraphExplorerComponent/GraphExplorer";
import { ContextualPaneBase } from "../Panes/ContextualPaneBase";
import GraphStylingPane from "../Panes/GraphStylingPane";
import { NewVertexPanel } from "../Panes/NewVertexPanel/NewVertexPanel";
import TabsBase from "./TabsBase";
export interface GraphIconMap {
  [key: string]: { data: string; format: string };
}

export interface GraphConfig {
  nodeColor: ko.Observable<string>;
  nodeColorKey: ko.Observable<string>; // map property to node color. Takes precedence over nodeColor unless undefined
  linkColor: ko.Observable<string>;
  showNeighborType: ko.Observable<ViewModels.NeighborType>;
  nodeCaption: ko.Observable<string>;
  nodeSize: ko.Observable<number>;
  linkWidth: ko.Observable<number>;
  nodeIconKey: ko.Observable<string>;
  iconsMap: ko.Observable<GraphIconMap>;
}

interface GraphTabOptions extends ViewModels.TabOptions {
  account: DatabaseAccount;
  masterKey: string;
  collectionId: string;
  databaseId: string;
  collectionPartitionKeyProperty: string;
}

export default class GraphTab extends TabsBase {
  // Graph default configuration
  public static readonly DEFAULT_NODE_CAPTION = "id";
  private static readonly LINK_COLOR = "#aaa";
  private static readonly NODE_SIZE = 10;
  private static readonly NODE_COLOR = "orange";
  private static readonly LINK_WIDTH = 1;
  private graphExplorerProps: GraphExplorerProps;
  private isNewVertexDisabled: ko.Observable<boolean>;
  private isPropertyEditing: ko.Observable<boolean>;
  private isGraphDisplayed: ko.Observable<boolean>;
  private graphAccessor: GraphAccessor;
  private graphConfig: GraphConfig;
  private graphConfigUiData: ViewModels.GraphConfigUiData;
  private isFilterQueryLoading: ko.Observable<boolean>;
  private isValidQuery: ko.Observable<boolean>;
  private graphStylingPane: GraphStylingPane;
  private collectionPartitionKeyProperty: string;
  private contextualPane: ContextualPaneBase;

  constructor(options: GraphTabOptions) {
    super(options);

    this.graphStylingPane = options.collection && options.collection.container.graphStylingPane;
    this.collectionPartitionKeyProperty = options.collectionPartitionKeyProperty;

    this.isNewVertexDisabled = ko.observable(false);
    this.isPropertyEditing = ko.observable(false);
    this.isGraphDisplayed = ko.observable(false);
    this.graphAccessor = undefined;
    this.graphConfig = GraphTab.createGraphConfig();
    // TODO Merge this with this.graphConfig
    this.graphConfigUiData = GraphTab.createGraphConfigUiData(this.graphConfig);
    this.graphExplorerProps = {
      onGraphAccessorCreated: (instance: GraphAccessor): void => {
        this.graphAccessor = instance;
      },
      onIsNewVertexDisabledChange: (isDisabled: boolean): void => {
        this.isNewVertexDisabled(isDisabled);
        this.updateNavbarWithTabsButtons();
      },
      onIsPropertyEditing: (isEditing: boolean) => {
        this.isPropertyEditing(isEditing);
        this.updateNavbarWithTabsButtons();
      },
      onIsGraphDisplayed: (isDisplayed: boolean) => {
        this.isGraphDisplayed(isDisplayed);
        this.updateNavbarWithTabsButtons();
      },
      onResetDefaultGraphConfigValues: () => this.setDefaultGraphConfigValues(),
      graphConfig: this.graphConfig,
      graphConfigUiData: this.graphConfigUiData,
      onIsFilterQueryLoadingChange: (isFilterQueryLoading: boolean): void =>
        this.isFilterQueryLoading(isFilterQueryLoading),
      onIsValidQueryChange: (isValidQuery: boolean): void => this.isValidQuery(isValidQuery),
      collectionPartitionKeyProperty: options.collectionPartitionKeyProperty,
      graphBackendEndpoint: GraphTab.getGremlinEndpoint(options.account),
      databaseId: options.databaseId,
      collectionId: options.collectionId,
      masterKey: options.masterKey,
      onLoadStartKey: options.onLoadStartKey,
      onLoadStartKeyChange: (onLoadStartKey: number): void => {
        if (onLoadStartKey === undefined) {
          this.onLoadStartKey = undefined;
        }
      },
      resourceId: options.account.id,
    };

    this.isFilterQueryLoading = ko.observable(false);
    this.isValidQuery = ko.observable(true);
  }

  public static getGremlinEndpoint(account: DatabaseAccount): string {
    return account.properties.gremlinEndpoint
      ? GraphTab.sanitizeHost(account.properties.gremlinEndpoint)
      : `${account.name}.graphs.azure.com:443/`;
  }

  public render(): JSX.Element {
    return (
      <div className="graphExplorerContainer" role="tabpanel" id={this.tabId}>
        <GraphExplorer {...this.graphExplorerProps} />
      </div>
    );
  }

  public onTabClick(): void {
    super.onTabClick();
    this.collection.selectedSubnodeKind(ViewModels.CollectionTabKind.Graph);
  }

  /**
   * Removing leading http|https and remove trailing /
   * @param url
   * @return
   */
  private static sanitizeHost(url: string): string {
    if (!url) {
      return url;
    }
    return url.replace(/^(http|https):\/\//, "").replace(/\/$/, "");
  }

  /* Command bar */
  private showNewVertexEditor(): void {
    this.collection.container.openSidePanel(
      "New Vertex",
      <NewVertexPanel
        explorer={this.collection.container}
        partitionKeyPropertyProp={this.collectionPartitionKeyProperty}
        openNotificationConsole={() => this.collection.container.expandConsole()}
        onSubmit={(
          result: ViewModels.NewVertexData,
          onError: (errorMessage: string) => void,
          onSuccess: () => void
        ): void => {
          this.graphAccessor.addVertex(result).then(
            () => {
              onSuccess();
              this.contextualPane.cancel();
            },
            (error: GraphExplorerError) => {
              onError(error.title);
            }
          );
        }}
      />
    );
  }
  public openStyling(): void {
    this.setDefaultGraphConfigValues();
    // Update the styling pane with this instance
    this.graphStylingPane.setData(this.graphConfigUiData);
    this.graphStylingPane.open();
  }

  public static createGraphConfig(): GraphConfig {
    return {
      nodeColor: ko.observable(GraphTab.NODE_COLOR),
      nodeColorKey: ko.observable(undefined),
      linkColor: ko.observable(GraphTab.LINK_COLOR),
      showNeighborType: ko.observable(ViewModels.NeighborType.TARGETS_ONLY),
      nodeCaption: ko.observable(GraphTab.DEFAULT_NODE_CAPTION),
      nodeSize: ko.observable(GraphTab.NODE_SIZE),
      linkWidth: ko.observable(GraphTab.LINK_WIDTH),
      nodeIconKey: ko.observable(undefined),
      iconsMap: ko.observable({}),
    };
  }

  public static createGraphConfigUiData(graphConfig: GraphConfig): ViewModels.GraphConfigUiData {
    return {
      showNeighborType: ko.observable(graphConfig.showNeighborType()),
      nodeProperties: ko.observableArray([]),
      nodePropertiesWithNone: ko.observableArray([]),
      nodeCaptionChoice: ko.observable(graphConfig.nodeCaption()),
      nodeColorKeyChoice: ko.observable(graphConfig.nodeColorKey()),
      nodeIconChoice: ko.observable(graphConfig.nodeIconKey()),
      nodeIconSet: ko.observable(undefined),
    };
  }

  /**
   * Make sure graph config values are not undefined
   */
  private setDefaultGraphConfigValues() {
    // Assign default values if undefined
    if (
      this.graphConfigUiData.nodeCaptionChoice() === undefined &&
      this.graphConfigUiData.nodeProperties().length > 1
    ) {
      this.graphConfigUiData.nodeCaptionChoice(this.graphConfigUiData.nodeProperties()[0]);
    }
    if (
      this.graphConfigUiData.nodeColorKeyChoice() === undefined &&
      this.graphConfigUiData.nodePropertiesWithNone().length > 1
    ) {
      this.graphConfigUiData.nodeColorKeyChoice(this.graphConfigUiData.nodePropertiesWithNone()[0]);
    }
    if (
      this.graphConfigUiData.nodeIconChoice() === undefined &&
      this.graphConfigUiData.nodePropertiesWithNone().length > 1
    ) {
      this.graphConfigUiData.nodeIconChoice(this.graphConfigUiData.nodePropertiesWithNone()[0]);
    }
  }
  protected getTabsButtons(): CommandButtonComponentProps[] {
    const label = "New Vertex";
    const buttons: CommandButtonComponentProps[] = [
      {
        iconSrc: NewVertexIcon,
        iconAlt: label,
        onCommandClick: () => this.showNewVertexEditor(),
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: false,
        disabled: this.isNewVertexDisabled(),
      },
    ];
    buttons.push();
    if (this.isGraphDisplayed()) {
      const label = "Style";
      buttons.push({
        iconSrc: StyleIcon,
        iconAlt: label,
        onCommandClick: () => this.openStyling(),
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: false,
        disabled: this.isPropertyEditing(),
      });
    }
    return buttons;
  }
  protected buildCommandBarOptions(): void {
    ko.computed(() => ko.toJSON([this.isNewVertexDisabled])).subscribe(() => this.updateNavbarWithTabsButtons());
    this.updateNavbarWithTabsButtons();
  }
}
