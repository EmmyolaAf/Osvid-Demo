// components/ContentViewer.tsx
import applyDecorations from "@/helpers/applyDecorations"; // Assuming this returns a string with inline HTML for decorations (e.g., <strong>, <em>, <a>)
import { ContentNode } from "@/types"; // Make sure ContentNode and its nested types are fully defined
import React, { JSX } from "react";
import Image from "next/image"; // Import Next.js Image component

interface ContentViewerProps {
  nodes: ContentNode[];
  // Optional: add a base class for the entire viewer if needed
  className?: string;
  // Optional: for recursive calls, pass the parent class for context
  parentType?: ContentNode["type"] | "root";
}

const ContentViewer: React.FC<ContentViewerProps> = ({ nodes, className }) => {
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }

  // Define base classes for common elements.
  // These will be overridden or augmented by the 'prose' plugin if used.
  // We explicitly add them here for clarity and if the prose plugin isn't applied to parent.
  const baseClasses = {
    TEXT: "mb-4 text-gray-700 leading-relaxed",
    HEADING: {
      h1: "text-4xl font-extrabold mb-6 mt-10 text-gray-900",
      h2: "text-3xl font-bold mb-5 mt-8 text-gray-800",
      h3: "text-2xl font-semibold mb-4 mt-6 text-gray-700",
      h4: "text-xl font-medium mb-3 mt-5 text-gray-700",
      h5: "text-lg font-medium mb-2 mt-4 text-gray-600",
      h6: "text-base font-medium mb-1 mt-3 text-gray-600",
    },
    IMAGE: "my-8 rounded-lg shadow-md max-w-full h-auto",
    BULLETED_LIST: "list-disc pl-8 mb-4 space-y-2 text-gray-700",
    ORDERED_LIST: "list-decimal pl-8 mb-4 space-y-2 text-gray-700",
    LIST_ITEM: "leading-relaxed",
    BLOCKQUOTE:
      "border-l-4 border-blue-400 pl-4 py-2 my-6 italic text-gray-700 bg-blue-50",
    CODE_BLOCK:
      "bg-gray-800 text-white p-4 rounded-md overflow-x-auto text-sm my-6 font-mono",
    // You might add more styles for specific inline decorations here if `applyDecorations` doesn't handle it
    // E.g., strong: "font-bold", em: "italic", a: "text-blue-600 hover:underline"
  };

  return (
    <div className={className}>
      {" "}
      {/* Optional: Apply a base class to the root container */}
      {nodes.map((node, index) => {
        const key = node.id || `node-${index}`; // Ensure a stable key

        // Recursive rendering for nested content
        if (node.nodes && Array.isArray(node.nodes) && node.nodes.length > 0) {
          // Pass the current node's type to the recursive call for context-aware styling
          return (
            <div
              key={key}
              className={`node-container node-type-${node.type.toLowerCase()}`}
            >
              <ContentViewer nodes={node.nodes} parentType={node.type} />
            </div>
          );
        }

        switch (node.type) {
          case "TEXT":
            if (node.textData && node.textData.text !== undefined) {
              return (
                <p
                  key={key}
                  className={`${baseClasses.TEXT}`} // Apply base styling
                  dangerouslySetInnerHTML={{
                    __html: applyDecorations(
                      node.textData.text,
                      node.textData.decorations
                    ),
                  }}
                />
              );
            }
            return null; // Handle missing textData gracefully

          case "HEADING":
            if (node.headingData) {
              const level =
                node.headingData.level &&
                node.headingData.level >= 1 &&
                node.headingData.level <= 6
                  ? node.headingData.level
                  : 1;
              const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
              const headingClass =
                baseClasses.HEADING[
                  `h${level}` as keyof typeof baseClasses.HEADING
                ] || baseClasses.HEADING.h1;

              return React.createElement(
                HeadingTag,
                { key, className: headingClass }, // Apply styling
                applyDecorations(
                  node.headingData.text || "",
                  node.headingData.decorations || []
                )
              );
            }
            return null; // Handle missing headingData gracefully

          case "IMAGE":
            if (node.imageData && node.imageData.src) {
              return (
                <div
                  key={key}
                  className="relative w-full"
                  style={{ height: "400px" }}
                >
                  {" "}
                  {/* A flexible container for the image */}
                  <Image
                    src={node.imageData.src}
                    alt={node.imageData.alt || `Image for ${node.id || index}`}
                    fill // Use fill to make image responsive to container
                    className={`object-cover ${baseClasses.IMAGE}`} // Apply styling
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 50vw" // Add responsive sizes
                  />
                </div>
              );
            }
            return null; // Handle missing imageData gracefully

          case "BULLETED_LIST":
            if (node.listData && Array.isArray(node.listData.items)) {
              return (
                <ul key={key} className={baseClasses.BULLETED_LIST}>
                  {" "}
                  {/* Apply styling to the list */}
                  {node.listData.items.map((item, itemIndex) => (
                    <li
                      key={`${key}-item-${itemIndex}`}
                      className={baseClasses.LIST_ITEM} // Apply styling to list items
                      dangerouslySetInnerHTML={{
                        __html: applyDecorations(
                          item.textData?.text || "", // Use optional chaining for textData
                          item.textData?.decorations || []
                        ),
                      }}
                    />
                  ))}
                </ul>
              );
            }
            return null;

          case "ORDERED_LIST":
            if (node.listData && Array.isArray(node.listData.items)) {
              return (
                <ol key={key} className={baseClasses.ORDERED_LIST}>
                  {" "}
                  {/* Apply styling to the list */}
                  {node.listData.items.map((item, itemIndex) => (
                    <li
                      key={`${key}-item-${itemIndex}`}
                      className={baseClasses.LIST_ITEM} // Apply styling to list items
                      dangerouslySetInnerHTML={{
                        __html: applyDecorations(
                          item.textData?.text || "",
                          item.textData?.decorations || []
                        ),
                      }}
                    />
                  ))}
                </ol>
              );
            }
            return null;

          case "BLOCKQUOTE":
            if (node.quoteData) {
              const quoteText = applyDecorations(
                node.quoteData.text || "",
                node.quoteData.decorations || []
              );
              return (
                <blockquote
                  key={key}
                  className={baseClasses.BLOCKQUOTE} // Apply styling
                  dangerouslySetInnerHTML={{ __html: quoteText }}
                />
              );
            }
            return null;

          case "CODE_BLOCK":
            if (node.codeData) {
              return (
                <pre key={key} className={baseClasses.CODE_BLOCK}>
                  {" "}
                  {/* Apply styling */}
                  <code>{node.codeData.text || ""}</code>
                </pre>
              );
            }
            return null;

          default:
            console.warn(
              `[ContentViewer] Unhandled or missing data for node type: ${node.type}`,
              node
            );
            return null;
        }
      })}
    </div>
  );
};

export default ContentViewer;
