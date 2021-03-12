import Explorer from "../Explorer";
import * as ko from "knockout";
import { ResourceTree } from "./ResourceTree";
import * as ViewModels from "../../Contracts/ViewModels";
import TabsBase from "../Tabs/TabsBase";

describe("ResourceTreeAdapter", () => {
  const mockContainer = (): Explorer =>
    (({
      selectedNode: ko.observable<ViewModels.TreeNode>({
        nodeKind: "nodeKind",
        rid: "rid",
        id: ko.observable<string>("id"),
      }),
      tabsManager: {
        activeTab: ko.observable<TabsBase>({
          tabKind: ViewModels.CollectionTabKind.Documents,
        } as TabsBase),
      },
      isNotebookEnabled: ko.observable<boolean>(true),
      nonSystemDatabases: ko.observable<ViewModels.Database[]>([]),
    } as unknown) as Explorer);

  // TODO isDataNodeSelected needs a better design and refactor, but for now, we protect some of the code paths
  describe("isDataNodeSelected", () => {
    it("it should not select if no selected node", () => {
      const explorer = mockContainer();
      explorer.selectedNode(undefined);
      const resourceTree = new ResourceTree({
        explorer,
        lastRefreshedTime: 0,
        galleryContentRoot: undefined,
        myNotebooksContentRoot: undefined,
        gitHubNotebooksContentRoot: undefined,
      });
      const isDataNodeSelected = resourceTree.isDataNodeSelected("foo", "bar", undefined);
      expect(isDataNodeSelected).toBeFalsy();
    });

    it("it should not select incorrect subnodekinds", () => {
      const resourceTree = new ResourceTree({
        explorer: mockContainer(),
        lastRefreshedTime: 0,
        galleryContentRoot: undefined,
        myNotebooksContentRoot: undefined,
        gitHubNotebooksContentRoot: undefined,
      });
      const isDataNodeSelected = resourceTree.isDataNodeSelected("foo", "bar", undefined);
      expect(isDataNodeSelected).toBeFalsy();
    });

    it("it should not select if no active tab", () => {
      const explorer = mockContainer();
      explorer.tabsManager.activeTab(undefined);
      const resourceTree = new ResourceTree({
        explorer,
        lastRefreshedTime: 0,
        galleryContentRoot: undefined,
        myNotebooksContentRoot: undefined,
        gitHubNotebooksContentRoot: undefined,
      });
      const isDataNodeSelected = resourceTree.isDataNodeSelected("foo", "bar", undefined);
      expect(isDataNodeSelected).toBeFalsy();
    });

    it("should select if correct database node regardless of subnodekinds", () => {
      const subNodeKind = ViewModels.CollectionTabKind.Documents;
      const explorer = mockContainer();
      explorer.selectedNode(({
        nodeKind: "Database",
        rid: "dbrid",
        id: ko.observable<string>("dbid"),
        selectedSubnodeKind: ko.observable<ViewModels.CollectionTabKind>(subNodeKind),
      } as unknown) as ViewModels.TreeNode);
      const resourceTree = new ResourceTree({
        explorer,
        lastRefreshedTime: 0,
        galleryContentRoot: undefined,
        myNotebooksContentRoot: undefined,
        gitHubNotebooksContentRoot: undefined,
      });
      const isDataNodeSelected = resourceTree.isDataNodeSelected("dbid", undefined, [
        ViewModels.CollectionTabKind.Documents,
      ]);
      expect(isDataNodeSelected).toBeTruthy();
    });

    it("should select correct collection node (documents or graph node)", () => {
      let subNodeKind = ViewModels.CollectionTabKind.Documents;
      const explorer = mockContainer();
      explorer.tabsManager.activeTab({
        tabKind: subNodeKind,
      } as TabsBase);
      explorer.selectedNode(({
        nodeKind: "Collection",
        rid: "collrid",
        databaseId: "dbid",
        id: ko.observable<string>("collid"),
        selectedSubnodeKind: ko.observable<ViewModels.CollectionTabKind>(subNodeKind),
      } as unknown) as ViewModels.TreeNode);
      const resourceTree = new ResourceTree({
        explorer,
        lastRefreshedTime: 0,
        galleryContentRoot: undefined,
        myNotebooksContentRoot: undefined,
        gitHubNotebooksContentRoot: undefined,
      });
      let isDataNodeSelected = resourceTree.isDataNodeSelected("dbid", "collid", [subNodeKind]);
      expect(isDataNodeSelected).toBeTruthy();

      subNodeKind = ViewModels.CollectionTabKind.Graph;
      explorer.tabsManager.activeTab({
        tabKind: subNodeKind,
      } as TabsBase);
      explorer.selectedNode(({
        nodeKind: "Collection",
        rid: "collrid",
        databaseId: "dbid",
        id: ko.observable<string>("collid"),
        selectedSubnodeKind: ko.observable<ViewModels.CollectionTabKind>(subNodeKind),
      } as unknown) as ViewModels.TreeNode);
      isDataNodeSelected = resourceTree.isDataNodeSelected("dbid", "collid", [subNodeKind]);
      expect(isDataNodeSelected).toBeTruthy();
    });

    it("should not select incorrect collection node (e.g. Settings)", () => {
      const explorer = mockContainer();
      explorer.selectedNode(({
        nodeKind: "Collection",
        rid: "collrid",
        databaseId: "dbid",
        id: ko.observable<string>("collid"),
        selectedSubnodeKind: ko.observable<ViewModels.CollectionTabKind>(ViewModels.CollectionTabKind.Documents),
      } as unknown) as ViewModels.TreeNode);
      explorer.tabsManager.activeTab({
        tabKind: ViewModels.CollectionTabKind.Documents,
      } as TabsBase);
      const resourceTree = new ResourceTree({
        explorer,
        lastRefreshedTime: 0,
        galleryContentRoot: undefined,
        myNotebooksContentRoot: undefined,
        gitHubNotebooksContentRoot: undefined,
      });
      const isDataNodeSelected = resourceTree.isDataNodeSelected("dbid", "collid", [
        ViewModels.CollectionTabKind.Settings,
      ]);
      expect(isDataNodeSelected).toBeFalsy();
    });
  });
});
