import { CellId } from "@nteract/commutable";
import { CellType } from "@nteract/commutable/src";
import { actions, ContentRef } from "@nteract/core";
import { KernelOutputError, StreamText } from "@nteract/outputs";
import { Cells, CodeCell, RawCell } from "@nteract/stateful-components";
import MonacoEditor from "@nteract/stateful-components/lib/inputs/connected-editors/monacoEditor";
import { PassedEditorProps } from "@nteract/stateful-components/lib/inputs/editor";
import TransformMedia from "@nteract/stateful-components/lib/outputs/transform-media";
import * as React from "react";
import { DndProvider } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { connect } from "react-redux";
import { Dispatch } from "redux";
import { userContext } from "../../../UserContext";
import * as cdbActions from "../NotebookComponent/actions";
import loadTransform from "../NotebookComponent/loadTransform";
import { CdbAppState, SnapshotFragment } from "../NotebookComponent/types";
import { NotebookUtil } from "../NotebookUtil";
import { AzureTheme } from "./AzureTheme";
import "./base.css";
import CellCreator from "./decorators/CellCreator";
import CellLabeler from "./decorators/CellLabeler";
import HoverableCell from "./decorators/HoverableCell";
import KeyboardShortcuts from "./decorators/kbd-shortcuts";
import "./default.css";
import MarkdownCell from "./markdown-cell";
import "./NotebookRenderer.less";
import IFrameOutputs from "./outputs/IFrameOutputs";
import Prompt from "./Prompt";
import { promptContent } from "./PromptContent";
import StatusBar from "./StatusBar";
import CellToolbar from "./Toolbar";

export interface NotebookRendererBaseProps {
  contentRef: any;
}

interface NotebookRendererDispatchProps {
  storeNotebookSnapshot: (imageSrc: string, requestId: string) => void;
  notebookSnapshotError: (error: string) => void;
}

interface StateProps {
  pendingSnapshotRequest: {
    requestId: string;
    viewport: DOMRect;
  };
  cellOutputSnapshots: Map<string, SnapshotFragment>;
  notebookSnapshot: { imageSrc: string; requestId: string };
}

type NotebookRendererProps = NotebookRendererBaseProps & NotebookRendererDispatchProps & StateProps;

const decorate = (id: string, contentRef: ContentRef, cell_type: CellType, children: React.ReactNode) => {
  const Cell = () => (
    // TODO Draggable and HijackScroll not working anymore. Fix or remove when reworking MarkdownCell.
    // <DraggableCell id={id} contentRef={contentRef}>
    //   <HijackScroll id={id} contentRef={contentRef}>
    <CellCreator id={id} contentRef={contentRef}>
      <CellLabeler id={id} contentRef={contentRef}>
        <HoverableCell id={id} contentRef={contentRef}>
          {children}
        </HoverableCell>
      </CellLabeler>
    </CellCreator>
    //   </HijackScroll>
    // </DraggableCell>
  );

  Cell.defaultProps = { cell_type };
  return <Cell />;
};

class BaseNotebookRenderer extends React.Component<NotebookRendererProps> {
  private notebookRendererRef = React.createRef<HTMLDivElement>();

  constructor(props: NotebookRendererProps) {
    super(props);

    this.state = {
      hoveredCellId: undefined,
    };
  }

  componentDidMount() {
    loadTransform(this.props as any);
  }

  /**
   * @return true if there is a snapshot for each cell output
   */
  private areSnapshotForAllOutputsPresent(): boolean {
    for (let [key, value] of this.props.cellOutputSnapshots) {
      if (!value) {
        return false;
      }
    }
    return true;
  }

  componentDidUpdate() {
    // Take a snapshot if there's a pending request and all the outputs are also saved
    if (
      this.props.pendingSnapshotRequest &&
      (!this.props.notebookSnapshot ||
        this.props.pendingSnapshotRequest.requestId !== this.props.notebookSnapshot.requestId) &&
      this.areSnapshotForAllOutputsPresent()
    ) {
      NotebookUtil.takeScreenshot(
        this.notebookRendererRef.current,
        [...this.props.cellOutputSnapshots.values()],
        (error) => this.props.notebookSnapshotError(error.message),
        (imageSrc) => this.props.storeNotebookSnapshot(imageSrc, this.props.pendingSnapshotRequest.requestId)
      );
    }
  }

  render(): JSX.Element {
    return (
      <>
        <div className="NotebookRendererContainer">
          <div className="NotebookRenderer" ref={this.notebookRendererRef}>
            <DndProvider backend={HTML5Backend}>
              <KeyboardShortcuts contentRef={this.props.contentRef}>
                <Cells contentRef={this.props.contentRef}>
                  {{
                    code: ({ id, contentRef }: { id: CellId; contentRef: ContentRef }) =>
                      decorate(
                        id,
                        contentRef,
                        "code",
                        <CodeCell id={id} contentRef={contentRef} cell_type="code">
                          {{
                            editor: {
                              monaco: (props: PassedEditorProps) => <MonacoEditor {...props} editorType={"monaco"} />,
                            },
                            prompt: ({ id, contentRef }: { id: CellId; contentRef: ContentRef }) => (
                              <Prompt id={id} contentRef={contentRef} isHovered={false}>
                                {promptContent}
                              </Prompt>
                            ),
                            toolbar: () => <CellToolbar id={id} contentRef={contentRef} />,
                            outputs: userContext.features.sandboxNotebookOutputs
                              ? (props: any) => (
                                  <IFrameOutputs id={id} contentRef={contentRef}>
                                    <TransformMedia output_type={"display_data"} id={id} contentRef={contentRef} />
                                    <TransformMedia output_type={"execute_result"} id={id} contentRef={contentRef} />
                                    <KernelOutputError />
                                    <StreamText />
                                  </IFrameOutputs>
                                )
                              : undefined,
                          }}
                        </CodeCell>
                      ),
                    markdown: ({ id, contentRef }: { id: any; contentRef: ContentRef }) =>
                      decorate(
                        id,
                        contentRef,
                        "markdown",
                        <MarkdownCell id={id} contentRef={contentRef} cell_type="markdown">
                          {{
                            editor: {
                              monaco: (props: PassedEditorProps) => <MonacoEditor {...props} editorType={"monaco"} />,
                            },
                            toolbar: () => <CellToolbar id={id} contentRef={contentRef} />,
                          }}
                        </MarkdownCell>
                      ),

                    raw: ({ id, contentRef }: { id: any; contentRef: ContentRef }) =>
                      decorate(
                        id,
                        contentRef,
                        "raw",
                        <RawCell id={id} contentRef={contentRef} cell_type="raw">
                          {{
                            editor: {
                              monaco: (props: PassedEditorProps) => <MonacoEditor {...props} editorType={"monaco"} />,
                            },
                            toolbar: () => <CellToolbar id={id} contentRef={contentRef} />,
                          }}
                        </RawCell>
                      ),
                  }}
                </Cells>
              </KeyboardShortcuts>
              <AzureTheme />
            </DndProvider>
          </div>
          <StatusBar contentRef={this.props.contentRef} />
        </div>
      </>
    );
  }
}

export const makeMapStateToProps = (
  initialState: CdbAppState,
  ownProps: NotebookRendererProps
): ((state: CdbAppState) => StateProps) => {
  const mapStateToProps = (state: CdbAppState): StateProps => {
    const { pendingSnapshotRequest, cellOutputSnapshots, notebookSnapshot } = state.cdb;
    return { pendingSnapshotRequest, cellOutputSnapshots, notebookSnapshot };
  };
  return mapStateToProps;
};

const makeMapDispatchToProps = (initialDispatch: Dispatch, initialProps: NotebookRendererBaseProps) => {
  const mapDispatchToProps = (dispatch: Dispatch) => {
    return {
      addTransform: (transform: React.ComponentType & { MIMETYPE: string }) =>
        dispatch(
          actions.addTransform({
            mediaType: transform.MIMETYPE,
            component: transform,
          })
        ),
      storeNotebookSnapshot: (imageSrc: string, requestId: string) =>
        dispatch(cdbActions.storeNotebookSnapshot({ imageSrc, requestId })),
      notebookSnapshotError: (error: string) => dispatch(cdbActions.notebookSnapshotError({ error })),
    };
  };
  return mapDispatchToProps;
};

export default connect(makeMapStateToProps, makeMapDispatchToProps)(BaseNotebookRenderer);
