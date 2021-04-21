import { ImmutableDisplayData, ImmutableExecuteResult, JSONObject } from "@nteract/commutable";
import { Media } from "@nteract/outputs";
import { ContentRef } from "@nteract/types";
import React, { Suspense } from "react";

const EmptyTransform = (): JSX.Element => <></>;

const displayOrder = [
  "application/vnd.jupyter.widget-view+json",
  "application/vnd.vega.v5+json",
  "application/vnd.vega.v4+json",
  "application/vnd.vega.v3+json",
  "application/vnd.vega.v2+json",
  "application/vnd.vegalite.v4+json",
  "application/vnd.vegalite.v3+json",
  "application/vnd.vegalite.v2+json",
  "application/vnd.vegalite.v1+json",
  "application/geo+json",
  "application/vnd.plotly.v1+json",
  "text/vnd.plotly.v1+html",
  "application/x-nteract-model-debug+json",
  "application/vnd.dataresource+json",
  "application/vdom.v1+json",
  "application/json",
  "application/javascript",
  "text/html",
  "text/markdown",
  "text/latex",
  "image/svg+xml",
  "image/gif",
  "image/png",
  "image/jpeg",
  "text/plain",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformsById = new Map<string, React.ComponentType<any>>([
  ["text/vnd.plotly.v1+html", React.lazy(() => import("@nteract/transform-plotly"))],
  ["application/vnd.plotly.v1+json", React.lazy(() => import("@nteract/transform-plotly"))],
  ["application/geo+json", EmptyTransform], // TODO: The geojson transform will likely need some work because of the basemap URL(s)
  ["application/x-nteract-model-debug+json", React.lazy(() => import("@nteract/transform-model-debug"))],
  ["application/vnd.dataresource+json", React.lazy(() => import("@nteract/data-explorer"))],
  ["application/vnd.jupyter.widget-view+json", React.lazy(() => import("./transforms/WidgetDisplay"))],
  ["application/vnd.vegalite.v1+json", React.lazy(() => import("./transforms/VegaLite1"))],
  ["application/vnd.vegalite.v2+json", React.lazy(() => import("./transforms/VegaLite2"))],
  ["application/vnd.vegalite.v3+json", React.lazy(() => import("./transforms/VegaLite3"))],
  ["application/vnd.vegalite.v4+json", React.lazy(() => import("./transforms/VegaLite4"))],
  ["application/vnd.vega.v2+json", React.lazy(() => import("./transforms/Vega2"))],
  ["application/vnd.vega.v3+json", React.lazy(() => import("./transforms/Vega3"))],
  ["application/vnd.vega.v4+json", React.lazy(() => import("./transforms/Vega4"))],
  ["application/vnd.vega.v5+json", React.lazy(() => import("./transforms/Vega5"))],
  ["application/vdom.v1+json", React.lazy(() => import("@nteract/transform-vdom"))],
  ["application/json", Media.Json],
  ["application/javascript", Media.JavaScript],
  ["text/html", Media.HTML],
  ["text/markdown", Media.Markdown],
  ["text/latex", Media.LaTeX],
  ["image/svg+xml", Media.SVG],
  ["image/gif", Media.Image],
  ["image/png", Media.Image],
  ["image/jpeg", Media.Image],
  ["text/plain", Media.Plain],
]);

interface TransformMediaProps {
  output_type: string;
  id: string;
  contentRef: ContentRef;
  output?: ImmutableDisplayData | ImmutableExecuteResult;
  onMetadataChange: (metadata: JSONObject, mediaType: string) => void;
}

export const TransformMedia = (props: TransformMediaProps): JSX.Element => {
  const { Media, mediaType, data, metadata } = getMediaInfo(props);

  // If we had no valid result, return an empty output
  if (!mediaType || !data) {
    return <></>;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Media
        onMetadataChange={props.onMetadataChange}
        data={data}
        metadata={metadata}
        contentRef={props.contentRef}
        id={props.id}
      />
    </Suspense>
  );
};

const getMediaInfo = (props: TransformMediaProps) => {
  const { output, output_type } = props;
  // This component should only be used with display data and execute result
  if (!output || !(output_type === "display_data" || output_type === "execute_result")) {
    console.warn("connected transform media managed to get a non media bundle output");
    return {
      Media: EmptyTransform,
    };
  }

  // Find the first mediaType in the output data that we support with a handler
  const mediaType = displayOrder.find(
    (key) =>
      Object.prototype.hasOwnProperty.call(output.data, key) &&
      (Object.prototype.hasOwnProperty.call(transformsById, key) || transformsById.get(key))
  );

  if (mediaType) {
    const metadata = output.metadata.get(mediaType);
    const data = output.data[mediaType];

    const Media = transformsById.get(mediaType);
    return {
      Media,
      mediaType,
      data,
      metadata,
    };
  }

  return {
    Media: EmptyTransform,
    mediaType,
    output,
  };
};

export default TransformMedia;
