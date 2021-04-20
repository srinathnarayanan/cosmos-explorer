import { createImmutableOutput, JSONObject, OnDiskOutput } from "@nteract/commutable";
import KernelOutputError from "@nteract/outputs/lib/components/kernel-output-error";
import Output from "@nteract/outputs/lib/components/output";
import StreamText from "@nteract/outputs/lib/components/stream-text";
import "bootstrap/dist/css/bootstrap.css";
import postRobot from "post-robot";
import * as React from "react";
import * as ReactDOM from "react-dom";
import "../../externals/iframeResizer.contentWindow.min.js"; // Required for iFrameResizer to work
import "../Explorer/Notebook/NotebookRenderer/base.css";
import "../Explorer/Notebook/NotebookRenderer/default.css";
import { TransformMedia } from "./TransformMedia";

export interface OutputsProps {
  id: string;
  contentRef: string;
  hidden: boolean;
  expanded: boolean;
  outputs: OnDiskOutput[];
  onMetadataChange: (metadata: JSONObject, mediaType: string, index?: number) => void;
}

const onInit = async () => {
  postRobot.on(
    "props",
    {
      window: window.parent,
      domain: window.location.origin,
    },
    (event) => {
      // Typescript definition for event is wrong. So read props by casting to <any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (event as any).data;
      const props: OutputsProps = {
        id: data.id,
        contentRef: data.contentRef,
        hidden: data.hidden,
        expanded: data.expanded,
        outputs: data.outputs,
        onMetadataChange: data.onMetadataChange,
      };

      const outputs = (
        <div
          data-iframe-height
          className={`nteract-cell-outputs ${props.hidden ? "hidden" : ""} ${props.expanded ? "expanded" : ""}`}
        >
          {props.outputs?.map((output, index) => (
            <Output output={createImmutableOutput(output)} key={index}>
              <TransformMedia
                output_type={"display_data"}
                id={props.id}
                contentRef={props.contentRef}
                onMetadataChange={(metadata, mediaType) => props.onMetadataChange(metadata, mediaType, index)}
              />
              <TransformMedia
                output_type={"execute_result"}
                id={props.id}
                contentRef={props.contentRef}
                onMetadataChange={(metadata, mediaType) => props.onMetadataChange(metadata, mediaType, index)}
              />
              <KernelOutputError />
              <StreamText />
            </Output>
          ))}
        </div>
      );

      ReactDOM.render(outputs, document.getElementById("notebookOutput"));
    }
  );
};

// Entry point
window.addEventListener("load", onInit);