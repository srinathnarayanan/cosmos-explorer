/**
 * Wrapper around Notebook Viewer Read only content
 */
import { Notebook } from "@nteract/commutable";
import { createContentRef } from "@nteract/core";
import { IChoiceGroupProps, Icon, IProgressIndicatorProps, Link, ProgressIndicator } from "@fluentui/react";
import * as React from "react";
import { contents } from "rx-jupyter";
import { IGalleryItem, JunoClient } from "../../../Juno/JunoClient";
import * as GalleryUtils from "../../../Utils/GalleryUtils";
import { NotebookClientV2 } from "../../Notebook/NotebookClientV2";
import { NotebookComponentBootstrapper } from "../../Notebook/NotebookComponent/NotebookComponentBootstrapper";
import NotebookReadOnlyRenderer from "../../Notebook/NotebookRenderer/NotebookReadOnlyRenderer";
import { Dialog, DialogProps, TextFieldProps } from "../Dialog";
import { NotebookMetadataComponent } from "./NotebookMetadataComponent";
import "./NotebookViewerComponent.less";
import Explorer from "../../Explorer";
import { SessionStorageUtility } from "../../../Shared/StorageUtility";
import { DialogHost } from "../../../Utils/GalleryUtils";
import { getErrorMessage, getErrorStack, handleError } from "../../../Common/ErrorHandlingUtils";
import { traceFailure, traceStart, traceSuccess } from "../../../Shared/Telemetry/TelemetryProcessor";
import { Action } from "../../../Shared/Telemetry/TelemetryConstants";

export interface NotebookViewerComponentProps {
  container?: Explorer;
  junoClient?: JunoClient;
  notebookUrl: string;
  galleryItem?: IGalleryItem;
  isFavorite?: boolean;
  backNavigationText: string;
  hideInputs?: boolean;
  hidePrompts?: boolean;
  onBackClick: () => void;
  onTagClick: (tag: string) => void;
}

interface NotebookViewerComponentState {
  content: Notebook;
  galleryItem?: IGalleryItem;
  isFavorite?: boolean;
  dialogProps: DialogProps;
  showProgressBar: boolean;
}

export class NotebookViewerComponent
  extends React.Component<NotebookViewerComponentProps, NotebookViewerComponentState>
  implements DialogHost {
  private clientManager: NotebookClientV2;
  private notebookComponentBootstrapper: NotebookComponentBootstrapper;

  constructor(props: NotebookViewerComponentProps) {
    super(props);

    this.clientManager = new NotebookClientV2({
      connectionInfo: { authToken: undefined, notebookServerEndpoint: undefined },
      databaseAccountName: undefined,
      defaultExperience: "NotebookViewer",
      isReadOnly: true,
      cellEditorType: "monaco",
      autoSaveInterval: 365 * 24 * 3600 * 1000, // There is no way to turn off auto-save, set to 1 year
      contentProvider: contents.JupyterContentProvider, // NotebookViewer only knows how to talk to Jupyter contents API
    });

    this.notebookComponentBootstrapper = new NotebookComponentBootstrapper({
      notebookClient: this.clientManager,
      contentRef: createContentRef(),
    });

    this.state = {
      content: undefined,
      galleryItem: props.galleryItem,
      isFavorite: props.isFavorite,
      dialogProps: undefined,
      showProgressBar: true,
    };

    this.loadNotebookContent();
  }

  private async loadNotebookContent(): Promise<void> {
    const startKey = traceStart(Action.NotebooksGalleryViewNotebook, {
      notebookUrl: this.props.notebookUrl,
      notebookId: this.props.galleryItem?.id,
      isSample: this.props.galleryItem?.isSample,
    });

    try {
      const response = await fetch(this.props.notebookUrl);
      if (!response.ok) {
        this.setState({ showProgressBar: false });
        throw new Error(`Received HTTP ${response.status} while fetching ${this.props.notebookUrl}`);
      }

      traceSuccess(
        Action.NotebooksGalleryViewNotebook,
        {
          notebookUrl: this.props.notebookUrl,
          notebookId: this.props.galleryItem?.id,
          isSample: this.props.galleryItem?.isSample,
        },
        startKey
      );

      const notebook: Notebook = await response.json();
      GalleryUtils.removeNotebookViewerLink(notebook, this.props.galleryItem?.newCellId);
      this.notebookComponentBootstrapper.setContent("json", notebook);
      this.setState({ content: notebook, showProgressBar: false });

      if (this.props.galleryItem && !SessionStorageUtility.getEntry(this.props.galleryItem.id)) {
        const response = await this.props.junoClient.increaseNotebookViews(this.props.galleryItem.id);
        if (!response.data) {
          throw new Error(`Received HTTP ${response.status} while increasing notebook views`);
        }
        this.setState({ galleryItem: response.data });
        SessionStorageUtility.setEntry(this.props.galleryItem?.id, "true");
      }
    } catch (error) {
      traceFailure(
        Action.NotebooksGalleryViewNotebook,
        {
          notebookUrl: this.props.notebookUrl,
          notebookId: this.props.galleryItem?.id,
          isSample: this.props.galleryItem?.isSample,
          error: getErrorMessage(error),
          errorStack: getErrorStack(error),
        },
        startKey
      );

      this.setState({ showProgressBar: false });
      handleError(error, "NotebookViewerComponent/loadNotebookContent", "Failed to load notebook content");
    }
  }

  public render(): JSX.Element {
    return (
      <div className="notebookViewerContainer">
        {this.props.backNavigationText !== undefined ? (
          <Link onClick={this.props.onBackClick}>
            <Icon iconName="Back" /> {this.props.backNavigationText}
          </Link>
        ) : (
          <></>
        )}

        {this.state.galleryItem ? (
          <div style={{ margin: 10 }}>
            <NotebookMetadataComponent
              data={this.state.galleryItem}
              isFavorite={this.state.isFavorite}
              downloadButtonText={this.props.container && "Download to my notebooks"}
              onTagClick={this.props.onTagClick}
              onFavoriteClick={this.favoriteItem}
              onUnfavoriteClick={this.unfavoriteItem}
              onDownloadClick={this.downloadItem}
              onReportAbuseClick={this.state.galleryItem.isSample ? undefined : this.reportAbuse}
            />
          </div>
        ) : (
          <></>
        )}

        {this.state.showProgressBar && <ProgressIndicator />}

        {this.notebookComponentBootstrapper.renderComponent(NotebookReadOnlyRenderer, {
          hideInputs: this.props.hideInputs,
          hidePrompts: this.props.hidePrompts,
        })}

        {this.state.dialogProps && <Dialog {...this.state.dialogProps} />}
      </div>
    );
  }

  public static getDerivedStateFromProps(
    props: NotebookViewerComponentProps,
    state: NotebookViewerComponentState
  ): Partial<NotebookViewerComponentState> {
    let galleryItem = props.galleryItem;
    let isFavorite = props.isFavorite;

    if (state.galleryItem !== undefined) {
      galleryItem = state.galleryItem;
    }

    if (state.isFavorite !== undefined) {
      isFavorite = state.isFavorite;
    }

    return {
      galleryItem,
      isFavorite,
    };
  }

  // DialogHost
  showOkModalDialog(
    title: string,
    msg: string,
    okLabel: string,
    onOk: () => void,
    progressIndicatorProps?: IProgressIndicatorProps
  ): void {
    this.setState({
      dialogProps: {
        isModal: true,
        visible: true,
        title,
        subText: msg,
        primaryButtonText: okLabel,
        onPrimaryButtonClick: () => {
          this.setState({ dialogProps: undefined });
          onOk && onOk();
        },
        secondaryButtonText: undefined,
        onSecondaryButtonClick: undefined,
        progressIndicatorProps,
      },
    });
  }

  // DialogHost
  showOkCancelModalDialog(
    title: string,
    msg: string,
    okLabel: string,
    onOk: () => void,
    cancelLabel: string,
    onCancel: () => void,
    progressIndicatorProps?: IProgressIndicatorProps,
    choiceGroupProps?: IChoiceGroupProps,
    textFieldProps?: TextFieldProps,
    primaryButtonDisabled?: boolean
  ): void {
    this.setState({
      dialogProps: {
        isModal: true,
        visible: true,
        title,
        subText: msg,
        primaryButtonText: okLabel,
        secondaryButtonText: cancelLabel,
        onPrimaryButtonClick: () => {
          this.setState({ dialogProps: undefined });
          onOk && onOk();
        },
        onSecondaryButtonClick: () => {
          this.setState({ dialogProps: undefined });
          onCancel && onCancel();
        },
        progressIndicatorProps,
        choiceGroupProps,
        textFieldProps,
        primaryButtonDisabled,
      },
    });
  }

  private favoriteItem = async (): Promise<void> => {
    GalleryUtils.favoriteItem(this.props.container, this.props.junoClient, this.state.galleryItem, (item) =>
      this.setState({ galleryItem: item, isFavorite: true })
    );
  };

  private unfavoriteItem = async (): Promise<void> => {
    GalleryUtils.unfavoriteItem(this.props.container, this.props.junoClient, this.state.galleryItem, (item) =>
      this.setState({ galleryItem: item, isFavorite: false })
    );
  };

  private downloadItem = async (): Promise<void> => {
    GalleryUtils.downloadItem(this.props.container, this.props.junoClient, this.state.galleryItem, (item) =>
      this.setState({ galleryItem: item })
    );
  };

  private reportAbuse = (): void => {
    GalleryUtils.reportAbuse(this.props.junoClient, this.state.galleryItem, this, () => {});
  };
}
