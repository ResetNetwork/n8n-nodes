import { INodeProperties, NodeConnectionType } from "n8n-workflow";

export const getConnectionHintNoticeField = (
  _connectionTypes: NodeConnectionType[],
): INodeProperties => {
  return {
    displayName: "",
    name: "notice",
    type: "notice",
    default: "",
    displayOptions: {
      show: {
        "@version": [1],
      },
    },
  };
};
