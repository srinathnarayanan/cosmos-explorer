import React from "react";
import ReactDOM from "react-dom";
import { copyStyles } from "../../../../Utils/StyleUtils";

interface SandboxFrameProps {
  style: React.CSSProperties;
  sandbox: string;
}

interface SandboxFrameState {
  frame: HTMLIFrameElement;
  frameBody: HTMLElement;
  frameHeight: number;
}

export class SandboxFrame extends React.PureComponent<SandboxFrameProps, SandboxFrameState> {
  private resizeObserver: ResizeObserver;
  private mutationObserver: MutationObserver;

  constructor(props: SandboxFrameProps) {
    super(props);

    this.state = {
      frame: undefined,
      frameBody: undefined,
      frameHeight: 0,
    };
  }

  render(): JSX.Element {
    return (
      <iframe
        ref={(ele) => this.setState({ frame: ele })}
        srcDoc={`<!DOCTYPE html>`}
        onLoad={(event) => this.onFrameLoad(event)}
        style={this.props.style}
        sandbox={this.props.sandbox}
        height={this.state.frameHeight}
      >
        {this.state.frameBody && ReactDOM.createPortal(this.props.children, this.state.frameBody)}
      </iframe>
    );
  }

  componentWillUnmount(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  onFrameLoad(event: React.SyntheticEvent<HTMLIFrameElement, Event>): void {
    const doc = (event.target as HTMLIFrameElement).contentDocument;
    copyStyles(document, doc);

    this.setState({ frameBody: doc.body });

    this.mutationObserver = new MutationObserver(() => {
      const bodyFirstElementChild = this.state.frameBody?.firstElementChild;
      if (!this.resizeObserver && bodyFirstElementChild) {
        this.resizeObserver = new ResizeObserver(() =>
          this.setState({
            frameHeight: this.state.frameBody?.firstElementChild.scrollHeight,
          })
        );
        this.resizeObserver.observe(bodyFirstElementChild);
      }
    });
    this.mutationObserver.observe(doc.body, { childList: true });
  }
}