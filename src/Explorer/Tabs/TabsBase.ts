import * as ko from "knockout";
import * as Constants from "../../Common/Constants";
import * as ThemeUtility from "../../Common/ThemeUtility";
import * as DataModels from "../../Contracts/DataModels";
import * as ViewModels from "../../Contracts/ViewModels";
import { RouteHandler } from "../../RouteHandlers/RouteHandler";
import { Action, ActionModifiers } from "../../Shared/Telemetry/TelemetryConstants";
import * as TelemetryProcessor from "../../Shared/Telemetry/TelemetryProcessor";
import { CommandButtonComponentProps } from "../Controls/CommandButton/CommandButtonComponent";
import Explorer from "../Explorer";
import { WaitsForTemplateViewModel } from "../WaitsForTemplateViewModel";
import { TabsManager } from "./TabsManager";

// TODO: Use specific actions for logging telemetry data
export default class TabsBase extends WaitsForTemplateViewModel {
  private static id = 0;
  public closeTabButton: ViewModels.Button;
  public node: ViewModels.TreeNode;
  public collection: ViewModels.CollectionBase;
  public database: ViewModels.Database;
  public rid: string;
  public tabId = `tab${TabsBase.id++}`;
  public tabKind: ViewModels.CollectionTabKind;
  public tabTitle: ko.Observable<string>;
  public tabPath: ko.Observable<string>;
  public hashLocation: ko.Observable<string>;
  public isExecutionError = ko.observable(false);
  public isExecuting = ko.observable(false);
  public pendingNotification?: ko.Observable<DataModels.Notification>;
  public manager?: TabsManager;
  protected _theme: string;
  public onLoadStartKey: number;

  constructor(options: ViewModels.TabOptions) {
    super();
    this._theme = ThemeUtility.getMonacoTheme(options.theme);
    this.node = options.node;
    this.collection = options.collection;
    this.database = options.database;
    this.rid = options.rid || (this.collection && this.collection.rid) || "";
    this.tabKind = options.tabKind;
    this.tabTitle = ko.observable<string>(options.title);
    this.tabPath =
      ko.observable(options.tabPath ?? "") ||
      (this.collection &&
        ko.observable<string>(`${this.collection.databaseId}>${this.collection.id()}>${this.tabTitle()}`));
    this.pendingNotification = ko.observable<DataModels.Notification>(undefined);
    this.onLoadStartKey = options.onLoadStartKey;
    this.hashLocation = ko.observable<string>(options.hashLocation || "");
    this.hashLocation.subscribe((newLocation: string) => this.updateGlobalHash(newLocation));
    this.closeTabButton = {
      enabled: ko.computed<boolean>(() => {
        return true;
      }),

      visible: ko.computed<boolean>(() => {
        return true;
      }),
    };
  }

  public onCloseTabButtonClick(): void {
    this.manager?.closeTab(this);
    TelemetryProcessor.trace(Action.Tab, ActionModifiers.Close, {
      tabName: this.constructor.name,
      dataExplorerArea: Constants.Areas.Tab,
      tabTitle: this.tabTitle(),
      tabId: this.tabId,
    });
  }

  public onTabClick(): void {
    this.manager?.activateTab(this);
  }

  protected updateSelectedNode(): void {
    const relatedDatabase = (this.collection && this.collection.getDatabase()) || this.database;
    if (relatedDatabase && !relatedDatabase.isDatabaseExpanded()) {
      this.getContainer().selectedNode(relatedDatabase);
    } else if (this.collection && !this.collection.isCollectionExpanded()) {
      this.getContainer().selectedNode(this.collection);
    } else {
      this.getContainer().selectedNode(this.node);
    }
  }

  private onSpaceOrEnterKeyPress(event: KeyboardEvent, callback: () => void): boolean {
    if (event.keyCode === Constants.KeyCodes.Space || event.keyCode === Constants.KeyCodes.Enter) {
      callback();
      event.stopPropagation();
      return false;
    }

    return true;
  }

  public onKeyPressActivate = (source: any, event: KeyboardEvent): boolean => {
    return this.onSpaceOrEnterKeyPress(event, () => this.onTabClick());
  };

  public onKeyPressClose = (source: any, event: KeyboardEvent): boolean => {
    return this.onSpaceOrEnterKeyPress(event, () => this.onCloseTabButtonClick());
  };

  /** @deprecated this is no longer observable, bind to comparisons with manager.activeTab() instead */
  public isActive() {
    return this === this.manager?.activeTab();
  }

  public onActivate(): void {
    this.updateSelectedNode();
    this.collection?.selectedSubnodeKind(this.tabKind);
    this.database?.selectedSubnodeKind(this.tabKind);
    this.updateGlobalHash(this.hashLocation());
    this.updateNavbarWithTabsButtons();
    TelemetryProcessor.trace(Action.Tab, ActionModifiers.Open, {
      tabName: this.constructor.name,
      dataExplorerArea: Constants.Areas.Tab,
      tabTitle: this.tabTitle(),
      tabId: this.tabId,
    });
  }

  public onErrorDetailsClick = (src: any, event: MouseEvent): boolean => {
    this.collection?.container?.expandConsole();
    this.database?.container?.expandConsole();
    return false;
  };

  public onErrorDetailsKeyPress = (src: any, event: KeyboardEvent): boolean => {
    if (event.keyCode === Constants.KeyCodes.Space || event.keyCode === Constants.KeyCodes.Enter) {
      this.onErrorDetailsClick(src, null);
      return false;
    }

    return true;
  };

  public refresh() {
    location.reload();
  }

  public getContainer(): Explorer {
    return (this.collection && this.collection.container) || (this.database && this.database.container);
  }

  /** Renders a Javascript object to be displayed inside Monaco Editor */
  protected renderObjectForEditor(value: any, replacer: any, space: string | number): string {
    return JSON.stringify(value, replacer, space);
  }

  private updateGlobalHash(newHash: string): void {
    RouteHandler.getInstance().updateRouteHashLocation(newHash);
  }

  /**
   * @return buttons that are displayed in the navbar
   */
  protected getTabsButtons(): CommandButtonComponentProps[] {
    return [];
  }

  protected updateNavbarWithTabsButtons = (): void => {
    if (this.isActive()) {
      this.getContainer().onUpdateTabsButtons(this.getTabsButtons());
    }
  };
}
