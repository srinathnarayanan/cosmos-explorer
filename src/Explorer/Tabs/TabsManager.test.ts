import * as ko from "knockout";
import * as ViewModels from "../../Contracts/ViewModels";
import { updateUserContext } from "../../UserContext";
import Explorer from "../Explorer";
import DocumentId from "../Tree/DocumentId";
import DocumentsTab from "./DocumentsTab";
import QueryTab from "./QueryTab";
import { TabsManager } from "./TabsManager";

describe("Tabs manager tests", () => {
  let tabsManager: TabsManager;
  let explorer: Explorer;
  let database: ViewModels.Database;
  let collection: ViewModels.Collection;
  let queryTab: QueryTab;
  let documentsTab: DocumentsTab;

  beforeAll(() => {
    explorer = new Explorer();
    updateUserContext({
      databaseAccount: {
        id: "test",
        name: "test",
        location: "",
        type: "",
        kind: "",
        properties: undefined,
      },
    });

    database = {
      container: explorer,
      id: ko.observable<string>("test"),
      isDatabaseShared: () => false,
    } as ViewModels.Database;
    database.isDatabaseExpanded = ko.observable<boolean>(true);
    database.selectedSubnodeKind = ko.observable<ViewModels.CollectionTabKind>();

    collection = {
      container: explorer,
      databaseId: "test",
      id: ko.observable<string>("test"),
    } as ViewModels.Collection;
    collection.getDatabase = (): ViewModels.Database => database;
    collection.isCollectionExpanded = ko.observable<boolean>(true);
    collection.selectedSubnodeKind = ko.observable<ViewModels.CollectionTabKind>();

    queryTab = new QueryTab({
      tabKind: ViewModels.CollectionTabKind.Query,
      collection,
      database,
      title: "",
      tabPath: "",
      hashLocation: "",
      onUpdateTabsButtons: undefined,
    });

    documentsTab = new DocumentsTab({
      partitionKey: undefined,
      documentIds: ko.observableArray<DocumentId>(),
      tabKind: ViewModels.CollectionTabKind.Documents,
      collection,
      title: "",
      tabPath: "",
      hashLocation: "",
      onUpdateTabsButtons: undefined,
    });

    // make sure tabs have different tabId
    queryTab.tabId = "1";
    documentsTab.tabId = "2";
  });

  beforeEach(() => (tabsManager = new TabsManager()));

  it("open new tabs", () => {
    tabsManager.activateNewTab(queryTab);
    expect(tabsManager.openedTabs().length).toBe(1);
    expect(tabsManager.openedTabs()[0]).toEqual(queryTab);
    expect(tabsManager.activeTab()).toEqual(queryTab);
    expect(queryTab.isActive()).toBe(true);

    tabsManager.activateNewTab(documentsTab);
    expect(tabsManager.openedTabs().length).toBe(2);
    expect(tabsManager.openedTabs()[1]).toEqual(documentsTab);
    expect(tabsManager.activeTab()).toEqual(documentsTab);
    expect(queryTab.isActive()).toBe(false);
    expect(documentsTab.isActive()).toBe(true);
  });

  it("open existing tabs", () => {
    tabsManager.activateNewTab(queryTab);
    tabsManager.activateNewTab(documentsTab);
    tabsManager.activateTab(queryTab);
    expect(tabsManager.openedTabs().length).toBe(2);
    expect(tabsManager.activeTab()).toEqual(queryTab);
    expect(queryTab.isActive()).toBe(true);
    expect(documentsTab.isActive()).toBe(false);
  });

  it("get tabs", () => {
    tabsManager.activateNewTab(queryTab);
    tabsManager.activateNewTab(documentsTab);

    const queryTabs = tabsManager.getTabs(ViewModels.CollectionTabKind.Query);
    expect(queryTabs.length).toBe(1);
    expect(queryTabs[0]).toEqual(queryTab);

    const documentsTabs = tabsManager.getTabs(
      ViewModels.CollectionTabKind.Documents,
      (tab) => tab.tabId === documentsTab.tabId
    );
    expect(documentsTabs.length).toBe(1);
    expect(documentsTabs[0]).toEqual(documentsTab);
  });

  it("close tabs", () => {
    tabsManager.activateNewTab(queryTab);
    tabsManager.activateNewTab(documentsTab);

    tabsManager.closeTab(documentsTab);
    expect(tabsManager.openedTabs().length).toBe(1);
    expect(tabsManager.openedTabs()[0]).toEqual(queryTab);
    expect(tabsManager.activeTab()).toEqual(queryTab);
    expect(queryTab.isActive()).toBe(true);
    expect(documentsTab.isActive()).toBe(false);

    tabsManager.closeTabsByComparator((tab) => tab.tabId === queryTab.tabId);
    expect(tabsManager.openedTabs().length).toBe(0);
    expect(tabsManager.activeTab()).toEqual(undefined);
    expect(queryTab.isActive()).toBe(false);
  });
});
