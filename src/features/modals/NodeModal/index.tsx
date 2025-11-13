import React from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  ScrollArea,
  Flex,
  CloseButton,
  Button,
  Group,
  Textarea,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Update JSON value at a specific path
const updateJsonAtPath = (json: string, path: NodeData["path"], newValue: string): string => {
  try {
    const obj = JSON.parse(json);

    if (!path || path.length === 0) {
      // If no path, try to parse the entire value
      try {
        return JSON.stringify(JSON.parse(newValue), null, 2);
      } catch {
        // If it fails, treat it as a string
        return JSON.stringify(newValue, null, 2);
      }
    }

    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = typeof path[i + 1] === "number" ? [] : {};
      }
      current = current[key];
    }

    const lastKey = path[path.length - 1];

    // Try to parse as JSON first, if it fails treat as string
    let parsedValue;
    try {
      parsedValue = JSON.parse(newValue);
    } catch {
      // If JSON parsing fails, check if it's a valid primitive
      parsedValue = newValue;
    }

    current[lastKey] = parsedValue;

    return JSON.stringify(obj, null, 2);
  } catch (e) {
    console.error("Failed to update JSON:", e);
    return json;
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setSelectedNode = useGraph(state => state.setSelectedNode);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");

  const json = useJson(state => state.json);
  const setJson = useJson(state => state.setJson);
  const setContents = useFile(state => state.setContents);

  React.useEffect(() => {
    if (nodeData && isEditing) {
      setEditValue(normalizeNodeData(nodeData.text ?? []));
    }
  }, [nodeData, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!nodeData) return;

    try {
      // Update JSON with new value at the node's path
      const updatedJson = updateJsonAtPath(json, nodeData.path, editValue);

      // Validate the result is valid JSON
      JSON.parse(updatedJson);

      const originalNodeId = nodeData.id;

      setJson(updatedJson);
      // Also update the file contents so the TextEditor reflects the changes
      setContents({ contents: updatedJson, hasChanges: true, skipUpdate: false });
      setIsEditing(false);

      // Wait for graph to regenerate, then find and re-select the node by ID
      setTimeout(() => {
        const currentNodes = useGraph.getState().nodes;
        const updatedNode = currentNodes.find(node => node.id === originalNodeId);
        if (updatedNode) {
          setSelectedNode(updatedNode);
        }
      }, 200);
    } catch (e) {
      console.error("Invalid JSON:", e);
      alert("Invalid JSON format. Please check your input.");
    }
  };
  const handleCancel = () => {
    setEditValue("");
    setIsEditing(false);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {isEditing ? (
              <Textarea
                value={editValue}
                onChange={e => setEditValue(e.currentTarget.value)}
                placeholder="Enter valid JSON"
                minRows={6}
                maxRows={10}
                style={{ minWidth: "350px", maxWidth: "600px" }}
              />
            ) : (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>

        <Group justify="flex-end" gap="xs">
          {!isEditing ? (
            <Button size="sm" onClick={handleEdit}>
              Edit
            </Button>
          ) : (
            <>
              <Button size="sm" variant="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  );
};
